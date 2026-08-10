/** twilioWebhookAuth v1.2.0 — URL pública fixa + parent/subconta na assinatura */
import twilio from 'twilio';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { getTwilioWebhookAuthTokens } from '../services/twilio/twilioClient.util';

export function resolveTwilioWebhookUrl(req: Request): string {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? '').split(',')[0].trim();
  const path = req.originalUrl.split('?')[0];
  return `${proto}://${host}${path}`;
}

/** Twilio assina a URL exata do webhook — tentamos pública (278491073220) e host do request. */
export function resolveTwilioWebhookUrlCandidates(req: Request): string[] {
  const path = req.originalUrl.split('?')[0];
  const urls: string[] = [];

  const publicBase = env.twilioWebhookPublicBaseUrl.trim().replace(/\/+$/, '');
  if (publicBase) urls.push(`${publicBase}${path}`);

  const fromRequest = resolveTwilioWebhookUrl(req);
  if (fromRequest) urls.push(fromRequest);

  return [...new Set(urls)];
}

function isTwilioSignatureValid(
  authToken: string,
  signature: string,
  url: string,
  body: Record<string, unknown>,
): boolean {
  try {
    return twilio.validateRequest(authToken, signature, url, body);
  } catch {
    return false;
  }
}

export function twilioWebhookAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!env.whatsappInboundEnabled) {
    res.status(503).json({ message: 'Inbound WhatsApp desabilitado' });
    return;
  }

  const authTokens = getTwilioWebhookAuthTokens();
  if (!authTokens.length) {
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

  const body = req.body as Record<string, unknown>;
  const urlCandidates = resolveTwilioWebhookUrlCandidates(req);
  const valid = urlCandidates.some((url) => authTokens.some(
    (token) => isTwilioSignatureValid(token, signature, url, body),
  ));

  if (!valid) {
    console.warn('[twilio-webhook] assinatura inválida', {
      path: req.originalUrl.split('?')[0],
      urlCandidates,
      tokensTried: authTokens.length,
    });
    res.status(403).json({ message: 'Assinatura Twilio inválida' });
    return;
  }

  next();
}
