/** inboundChannelClassifier v1.2.0 — classifica e-mail inbound por destino + remetente + PRIORIZAR */
import { normalizeEmail } from '../cliente.service';
import { isBacenRdrPrioritySubject } from './parseBacenRdrEmail.service';
import { isCgovPrioritySubject } from './parseConsumidorGovEmail.service';
import type { InboundEmailPayload } from './types';

export type InboundEspeciaisChannel = 'procon' | 'consumidor-gov' | 'bacen';

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

function recipientMatchesList(recipients: string[], allowedRecipients: string[]): boolean {
  if (!allowedRecipients.length) return false;
  const recipientSet = new Set(allowedRecipients.map((item) => normalizeEmail(item)));
  return recipients.some((item) => recipientSet.has(normalizeEmail(item)));
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

  const bcRecipients = readEnvList('INBOUND_EMAIL_BACEN_RECIPIENTS');
  const bcSenderPatterns = readEnvList('INBOUND_EMAIL_BACEN_SENDER_PATTERNS');

  if (recipientMatchesList(recipients, bcRecipients) && isBacenRdrPrioritySubject(payload.subject)) {
    return 'bacen';
  }

  if (matchesChannelRules(recipients, sender, bcRecipients, bcSenderPatterns)) {
    return 'bacen';
  }

  const cgRecipients = readEnvList('INBOUND_EMAIL_CONSUMIDOR_GOV_RECIPIENTS');
  const cgSenderPatterns = readEnvList('INBOUND_EMAIL_CONSUMIDOR_GOV_SENDER_PATTERNS');

  if (recipientMatchesList(recipients, cgRecipients) && isCgovPrioritySubject(payload.subject)) {
    return 'consumidor-gov';
  }

  if (matchesChannelRules(recipients, sender, cgRecipients, cgSenderPatterns)) {
    return 'consumidor-gov';
  }

  return null;
}
