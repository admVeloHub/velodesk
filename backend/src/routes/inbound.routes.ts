/** inbound.routes v1.7.2 — webhook auth URL pública Twilio */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { inboundAppAuthMiddleware, inboundEmailAuthMiddleware, inboundTelephonyAuthMiddleware } from '../middleware/inboundAuth';
import { twilioWebhookAuthMiddleware } from '../middleware/twilioWebhookAuth';
import {
  buildInboundTwimlReply,
  getWhatsAppInboundHealth,
  parseTwilioWhatsAppWebhook,
  processInboundWhatsAppMessage,
} from '../services/twilio/whatsappInbound.service';
import {
  parseTwilioMessageStatusWebhook,
  processWhatsAppMessageStatusCallback,
} from '../services/twilio/whatsappStatusCallback.service';
import { processAppNotify } from '../services/app-inbound.service';
import { isAllowedRecipient, processInboundEmail } from '../services/email-inbound.service';
import { parseInboundEmailPayload } from '../services/inbound-email/adapters';
import { handleGmailPubSubPush } from '../services/gmail/gmailInbound.service';
import { getGmailWatchHealth } from '../services/gmail/gmailWatch.service';
import { isEmailTransportReady } from '../services/emailTransport.service';
import {
  getInboundTelephonyRecados,
  processInboundTelephonyCall,
} from '../services/telephony-inbound/telephonyInbound.service';
import { countActiveRecados, getRecadosEnvelopeUpdatedAt, migrateLegacyRecadosIfNeeded } from '../services/telephonyRecado.service';

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
    const { processed, results, hasMore } = await handleGmailPubSubPush(req.body);

    if (hasMore) {
      console.info('[inbound/gmail/pubsub] backlog parcial — aguardando retry Pub/Sub', { processed });
      return res.status(503).json({
        ok: false,
        partial: true,
        processed,
        message: 'Backlog parcial — Pub/Sub reentregará para continuar',
      });
    }

    return res.status(200).json({ ok: true, processed, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[inbound/gmail/pubsub]', err);

    // Instância ainda subindo: 503 faz o Pub/Sub reentregar em vez de descartar a notificação
    if (/desk_config|MongoDB|indispon/i.test(message)) {
      return res.status(503).json({ ok: false, retry: true, message });
    }

    return res.status(500).json({ message: 'Falha ao processar notificação Gmail' });
  }
});

/** Telefonia IA — health check para parceira (sem autenticação) */
router.get('/telephony/health', async (_req, res: Response) => {
  const activeRecados = await countActiveRecados();
  const lastRecadoUpdate = await getRecadosEnvelopeUpdatedAt();
  res.json({
    status: 'ok',
    enabled: env.inboundTelephonyEnabled,
    apiVersion: '1.0.0',
    recadosSchemaVersion: '2.0',
    activeRecados,
    lastRecadoUpdate,
  });
});

router.post('/telephony/calls', inboundTelephonyAuthMiddleware, async (req, res: Response) => {
  try {
    const result = await processInboundTelephonyCall(req.body as Record<string, unknown>);
    const statusCode = result.action === 'created' ? 201 : 200;
    return res.status(statusCode).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/obrigatório|Informe/i.test(message)) {
      return res.status(400).json({ message });
    }
    console.error('[inbound/telephony/calls]', err);
    return res.status(500).json({ message: 'Falha ao processar ligação inbound' });
  }
});

router.get('/telephony/recados', inboundTelephonyAuthMiddleware, async (_req, res: Response) => {
  try {
    await migrateLegacyRecadosIfNeeded();
    const result = await getInboundTelephonyRecados();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(result);
  } catch (err) {
    console.error('[inbound/telephony/recados]', err);
    return res.status(500).json({ message: 'Falha ao carregar recados ativos' });
  }
});

/** WhatsApp Twilio — health (sem autenticação) */
router.get('/whatsapp/health', (req: Request, res: Response) => {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol);
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? 'localhost:8001');
  const baseUrl = `${proto}://${host}`;
  res.json(getWhatsAppInboundHealth(baseUrl));
});

/** WhatsApp Twilio — webhook inbound (quickstart: log + resposta TwiML) */
router.post('/whatsapp/messages', twilioWebhookAuthMiddleware, async (req, res: Response) => {
  try {
    const payload = parseTwilioWhatsAppWebhook(req.body as Record<string, unknown>);
    if (!payload.messageSid) {
      return res.status(400).type('text/plain').send('MessageSid ausente');
    }

    await processInboundWhatsAppMessage(payload);

    return res
      .status(200)
      .type('text/xml')
      .send(buildInboundTwimlReply());
  } catch (err) {
    console.error('[inbound/whatsapp/messages]', err);
    return res.status(500).type('text/plain').send('Falha ao processar mensagem WhatsApp');
  }
});

/** WhatsApp Twilio — status callback (sent / delivered / read / failed) */
router.post('/whatsapp/message-status', twilioWebhookAuthMiddleware, async (req, res: Response) => {
  try {
    const payload = parseTwilioMessageStatusWebhook(req.body as Record<string, unknown>);
    if (!payload.messageSid) {
      return res.status(400).type('text/plain').send('MessageSid ausente');
    }

    await processWhatsAppMessageStatusCallback(payload);
    return res.status(200).type('text/plain').send('');
  } catch (err) {
    console.error('[inbound/whatsapp/message-status]', err);
    return res.status(500).type('text/plain').send('Falha ao processar status WhatsApp');
  }
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
