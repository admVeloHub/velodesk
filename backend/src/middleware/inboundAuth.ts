/** inboundAuth v1.0.0 — validação de webhooks inbound */
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

function verifyMailgunSignature(req: Request): boolean {
  const signingKey = env.inboundEmailWebhookSecret;
  if (!signingKey) return env.nodeEnv !== 'production';

  const timestamp = String(req.body?.timestamp ?? '');
  const token = String(req.body?.token ?? '');
  const signature = String(req.body?.signature ?? '');

  if (!timestamp || !token || !signature) return false;

  const encoded = crypto.createHmac('sha256', signingKey).update(timestamp + token).digest('hex');
  return encoded === signature;
}

function verifySharedSecret(req: Request): boolean {
  const secret = env.inboundEmailWebhookSecret;
  if (!secret) return env.nodeEnv !== 'production';

  const header = String(req.headers['x-inbound-secret'] ?? '').trim();
  return header === secret;
}

export function inboundEmailAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.inboundEmailEnabled) {
    res.status(503).json({ message: 'Inbound e-mail desabilitado' });
    return;
  }

  const provider = env.inboundEmailProvider;
  let valid = false;

  if (provider === 'mailgun') {
    valid = verifyMailgunSignature(req);
  } else {
    valid = verifySharedSecret(req);
  }

  if (!valid) {
    res.status(401).json({ message: 'Assinatura inbound inválida' });
    return;
  }

  next();
}
