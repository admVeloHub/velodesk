/** inbound.routes v1.0.0 — POST /api/inbound/email */
import { Router, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { inboundEmailAuthMiddleware } from '../middleware/inboundAuth';
import { isAllowedRecipient, processInboundEmail } from '../services/email-inbound.service';
import { parseInboundEmailPayload } from '../services/inbound-email/adapters';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

router.get('/email/health', (_req, res: Response) => {
  res.json({
    status: 'ok',
    enabled: env.inboundEmailEnabled,
    provider: env.inboundEmailProvider,
  });
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

/** Fase 2 — telefonia (stub) */
router.post('/telephony', (_req, res: Response) => {
  res.status(501).json({ message: 'Inbound telefonia ainda não implementado' });
});

export default router;
