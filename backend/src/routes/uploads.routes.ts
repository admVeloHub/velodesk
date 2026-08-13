/** uploads.routes v1.5.0 — attachment + nosniff; inbound 423/403 na quarentena */
import path from 'path';
import multer from 'multer';
import { Router, Response, Request } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import {
  inspectInboundAttachmentGate,
  openInboundAttachment,
} from '../services/inboundAttachmentStorage.service';
import {
  openSentAttachment,
  persistSentAttachment,
} from '../services/sentAttachmentStorage.service';
import { openOctadeskLegacyAttachment } from '../services/octadeskLegacyAttachmentStorage.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

function sendOpenedAttachment(res: Response, opened: NonNullable<Awaited<ReturnType<typeof openInboundAttachment>>>) {
  const safeName = opened.filename.replace(/"/g, '');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (opened.source === 'disk' && opened.filePath) {
    return res.sendFile(path.resolve(opened.filePath));
  }

  if (opened.stream) {
    if (opened.contentType) res.setHeader('Content-Type', opened.contentType);
    opened.stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Falha ao ler anexo no bucket GCP.' });
      }
    });
    return opened.stream.pipe(res);
  }

  return res.status(404).json({ message: 'Anexo não encontrado' });
}

router.post('/signed-url', authMiddleware, async (req, res: Response) => {
  const fileName = String(req.body?.fileName ?? '').trim();
  const contentType = String(req.body?.contentType ?? 'application/octet-stream').trim();

  if (!fileName) {
    return res.status(400).json({ message: 'fileName é obrigatório' });
  }

  if (!env.gcpStorageBucket) {
    return res.status(503).json({
      message: 'Bucket GCP ainda não configurado. Informe GCP_STORAGE_BUCKET para habilitar uploads.',
    });
  }

  return res.status(501).json({
    message: 'Use POST /api/uploads/sent com multipart para anexos do agente.',
    bucket: env.gcpStorageBucket,
    prefix: env.gcpStorageSentAttachmentsPrefix,
    fileName,
    contentType,
  });
});

/** Anexo enviado pelo agente durante o atendimento → desk_ticket_sent_attachments/ */
router.post('/sent', authMiddleware, upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const ticketId = String(req.body?.ticketId ?? req.body?.ticket_id ?? '').trim();
    if (!ticketId) {
      return res.status(400).json({ message: 'ticketId é obrigatório' });
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) {
      return res.status(400).json({ message: 'Envie ao menos um arquivo no campo "files"' });
    }

    const uploaded = [];
    for (const file of files) {
      const saved = await persistSentAttachment({
        ticketId,
        filename: file.originalname,
        contentType: file.mimetype,
        buffer: file.buffer,
      });
      uploaded.push(saved);
    }

    return res.status(201).json({
      success: true,
      attachments: uploaded,
      urls: uploaded.map((item) => item.url),
    });
  } catch (err) {
    console.error('[uploads/sent]', err);
    return res.status(500).json({ message: (err as Error).message || 'Falha ao enviar anexo' });
  }
});

router.get('/inbound/:storageKey', authMiddleware, async (req, res: Response) => {
  try {
    const gate = await inspectInboundAttachmentGate(String(req.params.storageKey ?? ''));
    if (gate.state === 'pending') {
      return res.status(423).json({ message: 'Anexo em verificação. Tente novamente em instantes.' });
    }
    if (gate.state === 'infected') {
      return res.status(403).json({ message: 'Anexo bloqueado por segurança.' });
    }
    const opened = await openInboundAttachment(String(req.params.storageKey ?? ''));
    if (!opened) {
      const hasGcs = Boolean(String(env.gcpStorageBucket || '').trim());
      return res.status(404).json({
        message: hasGcs
          ? 'Anexo inbound não encontrado no servidor nem no bucket GCP.'
          : 'Anexo inbound não encontrado.',
      });
    }
    return sendOpenedAttachment(res, opened);
  } catch {
    return res.status(404).json({ message: 'Anexo não encontrado' });
  }
});

router.get('/sent/:storageKey', authMiddleware, async (req, res: Response) => {
  try {
    const opened = await openSentAttachment(String(req.params.storageKey ?? ''));
    if (!opened) {
      return res.status(404).json({ message: 'Anexo do agente não encontrado no bucket GCP.' });
    }
    return sendOpenedAttachment(res, opened);
  } catch {
    return res.status(404).json({ message: 'Anexo não encontrado' });
  }
});

/** Anexos importados do Octadesk → octadesk_legacy_attachments/ */
router.get('/octadesk-legacy/:storageKey', authMiddleware, async (req, res: Response) => {
  try {
    const opened = await openOctadeskLegacyAttachment(String(req.params.storageKey ?? ''));
    if (!opened) {
      return res.status(404).json({ message: 'Anexo legado Octadesk não encontrado no bucket GCP.' });
    }
    return sendOpenedAttachment(res, opened);
  } catch {
    return res.status(404).json({ message: 'Anexo não encontrado' });
  }
});

export default router;
