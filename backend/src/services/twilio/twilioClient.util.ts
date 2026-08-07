/** twilioClient.util v1.2.0 — API Key ou Auth Token (subconta Velodesk) */
import twilio from 'twilio';
import { env } from '../../config/env';

export type TwilioCredentialMode = 'subaccount' | 'parent' | 'api-key';

export interface TwilioResolvedCredentials {
  accountSid: string;
  authToken: string;
  mode: TwilioCredentialMode;
  apiKeySid?: string;
  apiKeySecret?: string;
}

function isPlaceholderToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v.includes('<') || v.includes('token principal');
}

function resolveSubaccountSid(): string {
  return env.twilioSubaccountSid.trim() || env.twilioAccountSid.trim();
}

/** API Key (SK...) — recomendado quando Auth Token da subconta falha. */
export function resolveTwilioApiKeyCredentials(): TwilioResolvedCredentials | null {
  const apiKeySid = env.twilioApiKeySid.trim();
  const apiKeySecret = env.twilioApiKeySecret.trim();
  const accountSid = resolveSubaccountSid();
  if (!apiKeySid || !apiKeySecret || !accountSid) return null;
  if (!apiKeySid.startsWith('SK')) return null;
  return {
    accountSid,
    authToken: env.twilioSubaccountAuthToken.trim() || env.twilioAuthToken.trim(),
    mode: 'api-key',
    apiKeySid,
    apiKeySecret,
  };
}

export function resolveTwilioMessagingCredentials(): TwilioResolvedCredentials | null {
  const apiKey = resolveTwilioApiKeyCredentials();
  if (apiKey) return apiKey;

  const subSid = env.twilioSubaccountSid.trim();
  const subToken = env.twilioSubaccountAuthToken.trim();
  if (subSid && subToken && !isPlaceholderToken(subToken)) {
    return { accountSid: subSid, authToken: subToken, mode: 'subaccount' };
  }

  const parentSid = env.twilioAccountSid.trim();
  const parentToken = env.twilioAuthToken.trim();
  if (parentSid && parentToken && !isPlaceholderToken(parentToken)) {
    return { accountSid: parentSid, authToken: parentToken, mode: 'parent' };
  }

  return null;
}

export function resolveTwilioParentCredentials(): TwilioResolvedCredentials | null {
  const parentSid = env.twilioAccountSid.trim();
  const parentToken = env.twilioAuthToken.trim();
  if (!parentSid || !parentToken || isPlaceholderToken(parentToken)) return null;
  return { accountSid: parentSid, authToken: parentToken, mode: 'parent' };
}

export function isTwilioConfigured(): boolean {
  return resolveTwilioMessagingCredentials() !== null;
}

export function getTwilioCredentialMode(): TwilioCredentialMode | null {
  return resolveTwilioMessagingCredentials()?.mode ?? null;
}

/** Cliente para envio/recebimento WhatsApp — prioriza API Key, depois subconta. */
export function getTwilioClient(): ReturnType<typeof twilio> {
  const creds = resolveTwilioMessagingCredentials();
  if (!creds) {
    throw new Error(
      'Twilio não configurado — defina TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (+ subconta), '
      + 'ou TWILIO_SUBACCOUNT_SID + TWILIO_SUBACCOUNT_AUTH_TOKEN',
    );
  }
  if (creds.mode === 'api-key' && creds.apiKeySid && creds.apiKeySecret) {
    return twilio(creds.apiKeySid, creds.apiKeySecret, { accountSid: creds.accountSid });
  }
  return twilio(creds.accountSid, creds.authToken);
}

/** Cliente da conta principal — criar subcontas e operações admin. */
export function getTwilioParentClient(): ReturnType<typeof twilio> {
  const creds = resolveTwilioParentCredentials();
  if (!creds) {
    throw new Error('Conta principal Twilio não configurada — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN');
  }
  return twilio(creds.accountSid, creds.authToken);
}

export function getTwilioWhatsAppFrom(): string {
  const from = env.twilioWhatsappFrom.trim();
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_FROM ausente — ex.: whatsapp:+14155238886 (Sandbox)');
  }
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}

/** Auth token para validação de webhook (X-Twilio-Signature) — não usa API Key. */
export function getTwilioActiveAuthToken(): string {
  const subToken = env.twilioSubaccountAuthToken.trim();
  if (subToken && !isPlaceholderToken(subToken)) return subToken;
  const parentToken = env.twilioAuthToken.trim();
  if (parentToken && !isPlaceholderToken(parentToken)) return parentToken;
  return '';
}

export function getTwilioActiveAccountSid(): string {
  return resolveSubaccountSid();
}
