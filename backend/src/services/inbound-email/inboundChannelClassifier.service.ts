/** inboundChannelClassifier v1.0.0 — classifica e-mail inbound por destino + remetente */
import { normalizeEmail } from '../cliente.service';
import type { InboundEmailPayload } from './types';

export type InboundEspeciaisChannel = 'procon' | 'consumidor-gov';

function readEnvList(key: string): string[] {
  return String(process.env[key] || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizePattern(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

function senderMatchesPattern(senderEmail: string, pattern: string): boolean {
  const sender = normalizeEmail(senderEmail);
  const raw = normalizePattern(pattern);
  if (!raw) return false;
  const normalized = raw.startsWith('@') ? raw : `@${raw.replace(/^@+/, '')}`;
  return sender.includes(normalized) || sender.endsWith(normalized.replace(/^@/, ''));
}

function matchesChannelRules(
  recipients: string[],
  senderEmail: string,
  allowedRecipients: string[],
  senderPatterns: string[],
): boolean {
  if (!allowedRecipients.length || !senderPatterns.length) return false;
  const recipientSet = new Set(allowedRecipients.map((item) => normalizeEmail(item)));
  const recipientHit = recipients.some((item) => recipientSet.has(normalizeEmail(item)));
  if (!recipientHit) return false;
  return senderPatterns.some((pattern) => senderMatchesPattern(senderEmail, pattern));
}

export function classifyInboundEspeciaisChannel(
  payload: InboundEmailPayload,
): InboundEspeciaisChannel | null {
  const sender = payload.from.email;
  const recipients = payload.to || [];

  if (matchesChannelRules(
    recipients,
    sender,
    readEnvList('INBOUND_EMAIL_PROCON_RECIPIENTS'),
    readEnvList('INBOUND_EMAIL_PROCON_SENDER_PATTERNS'),
  )) {
    return 'procon';
  }

  if (matchesChannelRules(
    recipients,
    sender,
    readEnvList('INBOUND_EMAIL_CONSUMIDOR_GOV_RECIPIENTS'),
    readEnvList('INBOUND_EMAIL_CONSUMIDOR_GOV_SENDER_PATTERNS'),
  )) {
    return 'consumidor-gov';
  }

  return null;
}
