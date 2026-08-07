/** twilioWebhookAuth v1.0.0 — validação X-Twilio-Signature */
import twilio from 'twilio';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { getTwilioActiveAuthToken } from '../services/twilio/twilioClient.util';

export function resolveTwilioWebhookUrl(req: Request): string {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim();
  const path = req.originalUrl.split('?')[0];
  return `${proto}://${host}${path}`;
}

export function twilioWebhookAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.whatsappInboundEnabled) {
    res.status(503).json({ message: 'Inbound WhatsApp desabilitado' });
    return;
  }

  const authToken = getTwilioActiveAuthToken().trim() || env.twilioAuthToken.trim();
  if (!authToken) {
    if (env.nodeEnv !== 'production') {
      next();
      return;
    }
    res.status(503).json({ message: 'Inbound WhatsApp desabilitado — TWILIO_AUTH_TOKEN ausente' });
    return;
  }

  if (env.twilioWebhookSkipValidation && env.nodeEnv !== 'production') {
    next();
    return;
  }

  const signature = String(req.headers['x-twilio-signature'] ?? '').trim();
  if (!signature) {
    res.status(401).json({ message: 'Assinatura Twilio ausente' });
    return;
  }

  const valid = twilio.validateRequest(
    authToken,
    signature,
    resolveTwilioWebhookUrl(req),
    req.body as Record<string, unknown>,
  );

  if (!valid) {
    res.status(403).json({ message: 'Assinatura Twilio inválida' });
    return;
  }

  next();
}
