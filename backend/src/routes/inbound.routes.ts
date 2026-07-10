/** inbound.routes v1.2.0 — app-notify pós-insert MongoDB */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { inboundAppAuthMiddleware, inboundEmailAuthMiddleware } from '../middleware/inboundAuth';
import { processAppNotify } from '../services/app-inbound.service';
import { isAllowedRecipient, processInboundEmail } from '../services/email-inbound.service';
import { parseInboundEmailPayload } from '../services/inbound-email/adapters';
import { handleGmailPubSubPush } from '../services/gmail/gmailInbound.service';
import { getGmailWatchHealth } from '../services/gmail/gmailWatch.service';
import { isEmailTransportReady } from '../services/emailTransport.service';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

router.get('/email/health', (_req, res: Response) => {
  res.json({
    status: 'ok',
    enabled: env.inboundEmailEnabled,
    provider: env.inboundEmailProvider,
    emailTransportReady: isEmailTransportReady(),
  });
});

router.get('/gmail/health', async (_req, res: Response) => {
  try {
    const watch = await getGmailWatchHealth();
    res.json({ status: 'ok', ...watch });
  } catch (err) {
    res.status(500).json({ status: 'error', message: (err as Error).message });
  }
});

router.post(
  '/email',
  upload.any(),
  inboundEmailAuthMiddleware,
  async (req, res: Response) => {
    try {
      const payload = parseInboundEmailPayload(req.body as Record<string, unknown>);

      if (!payload.from.email) {
        return res.status(400).json({ message: 'Remetente inválido' });
      }

      if (!isAllowedRecipient(payload, env.inboundEmailAllowedRecipients)) {
        return res.status(403).json({ message: 'Destinatário não autorizado' });
      }

      const result = await processInboundEmail(payload);
      const statusCode = result.action === 'created' ? 201 : 200;
      return res.status(statusCode).json(result);
    } catch (err) {
      console.error('[inbound/email]', err);
      return res.status(500).json({ message: 'Falha ao processar e-mail inbound' });
    }
  }
);

router.post('/gmail/pubsub', async (req: Request, res: Response) => {
  if (!env.gmailInboundEnabled) {
    return res.status(503).json({ message: 'Gmail inbound desabilitado' });
  }

  const token = String(req.query.token ?? '').trim();
  if (env.gmailPubsubVerifyToken && token !== env.gmailPubsubVerifyToken) {
    return res.status(401).json({ message: 'Token Pub/Sub inválido' });
  }

  try {
    const { processed, results } = await handleGmailPubSubPush(req.body);
    return res.status(200).json({ ok: true, processed, results });
  } catch (err) {
    console.error('[inbound/gmail/pubsub]', err);
    return res.status(500).json({ message: 'Falha ao processar notificação Gmail' });
  }
});

/** Fase 2 — telefonia (stub) */
router.post('/telephony', (_req, res: Response) => {
  res.status(501).json({ message: 'Inbound telefonia ainda não implementado' });
});

router.post('/app-notify', inboundAppAuthMiddleware, async (req, res: Response) => {
  try {
    const result = await processAppNotify({
      chamadoId: req.body?.chamadoId,
      chamadoProtocolo: req.body?.chamadoProtocolo,
    });
    const statusCode = result.action === 'processed' ? 200 : 200;
    return res.status(statusCode).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Chamado não encontrado') {
      return res.status(404).json({ message });
    }
    if (message.includes('inválido') || message.includes('Informe')) {
      return res.status(400).json({ message });
    }
    console.error('[inbound/app-notify]', err);
    return res.status(500).json({ message: 'Falha ao processar notificação do app' });
  }
});

export default router;
