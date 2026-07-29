/** uploads.routes v1.1.0 — signed URL GCP + download anexos inbound */
import fs from 'fs/promises';
import path from 'path';
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { resolveInboundAttachmentPath } from '../services/inboundAttachmentStorage.service';

const router = Router();

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
    message: 'Geração de signed URL pendente de configuração do bucket GCP.',
    bucket: env.gcpStorageBucket,
    fileName,
    contentType,
  });
});

router.get('/inbound/:storageKey', authMiddleware, async (req, res: Response) => {
  try {
    const filePath = resolveInboundAttachmentPath(String(req.params.storageKey ?? ''));
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/"/g, '')}"`);
    res.sendFile(filePath);
  } catch {
    return res.status(404).json({ message: 'Anexo não encontrado' });
  }
});

export default router;
