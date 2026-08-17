/** whatsappOutbound.service v1.4.0 — sessão 24h com texto e/ou mídia (mediaUrl) */
import { getTwilioClient, getTwilioWhatsAppFrom, isTwilioConfigured } from './twilioClient.util';
import { resolveWhatsAppStatusCallbackUrl } from './whatsappCallbackUrl.util';
import { normalizePhoneE164 } from '../telephonyRecado.validation';
import { env } from '../../config/env';

export interface WhatsAppOutboundResult {
  sent: boolean;
  sid?: string;
  body?: string;
  reason?: string;
}

function normalizeWhatsAppAddress(value: string): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^whatsapp:/i, '');
  const e164 = normalizePhoneE164(withoutPrefix) ?? normalizePhoneE164(withoutPrefix.replace(/\D/g, ''));
  if (!e164) return '';
  return `whatsapp:${e164}`;
}

function buildStatusCallbackParams(): { statusCallback?: string; statusCallbackMethod?: 'POST' } {
  const statusCallback = resolveWhatsAppStatusCallbackUrl();
  if (!statusCallback) return {};
  return {
    statusCallback,
    statusCallbackMethod: 'POST',
  };
}

/** Mensagem business-initiated via template aprovado (Utility / Authentication). */
export async function sendWhatsAppTemplateMessage(options: {
  to: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<WhatsAppOutboundResult> {
  if (!isTwilioConfigured()) {
    return { sent: false, reason: 'Twilio não configurado' };
  }

  const to = normalizeWhatsAppAddress(options.to);
  if (!to || to === 'whatsapp:') {
    return { sent: false, reason: 'Destino inválido' };
  }

  const contentSid = String(options.contentSid ?? env.twilioWhatsappContentSid).trim();
  if (!contentSid) {
    return { sent: false, reason: 'TWILIO_WHATSAPP_CONTENT_SID ausente' };
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      from: getTwilioWhatsAppFrom(),
      to,
      contentSid,
      contentVariables: JSON.stringify(options.contentVariables ?? {
        1: new Date().toLocaleDateString('en-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
        2: new Date().toLocaleTimeString('pt-BR', { hour: 'numeric', minute: '2-digit' }),
      }),
      ...buildStatusCallbackParams(),
    });

    return {
      sent: true,
      sid: message.sid,
      body: message.body ?? undefined,
    };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

/** @deprecated use sendWhatsAppTemplateMessage */
export const sendWhatsAppSandboxTemplate = sendWhatsAppTemplateMessage;

/** Mensagem free-form (janela de atendimento 24h após msg do cliente). */
export async function sendWhatsAppTextMessage(options: {
  to: string;
  body: string;
}): Promise<WhatsAppOutboundResult> {
  return sendWhatsAppSessionMessage({ to: options.to, body: options.body });
}

/** Texto e/ou uma mídia por mensagem (WhatsApp suporta um mediaUrl por envio). */
export async function sendWhatsAppSessionMessage(options: {
  to: string;
  body?: string;
  mediaUrl?: string;
}): Promise<WhatsAppOutboundResult> {
  if (!isTwilioConfigured()) {
    return { sent: false, reason: 'Twilio não configurado' };
  }

  const to = normalizeWhatsAppAddress(options.to);
  const body = String(options.body ?? '').trim();
  const mediaUrl = String(options.mediaUrl ?? '').trim();
  if (!to || to === 'whatsapp:') {
    return { sent: false, reason: 'Destino inválido' };
  }
  if (!body && !mediaUrl) {
    return { sent: false, reason: 'Texto ou mídia é obrigatório' };
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      from: getTwilioWhatsAppFrom(),
      to,
      ...(body ? { body } : {}),
      ...(mediaUrl ? { mediaUrl: [mediaUrl] } : {}),
      ...buildStatusCallbackParams(),
    });

    return {
      sent: true,
      sid: message.sid,
      body: message.body ?? body ?? undefined,
    };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

/** Várias mídias → uma mensagem Twilio por arquivo (legenda só na primeira). */
export async function sendWhatsAppSessionMessageBatch(options: {
  to: string;
  body?: string;
  mediaUrls?: string[];
}): Promise<WhatsAppOutboundResult> {
  const mediaUrls = (options.mediaUrls ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  const text = String(options.body ?? '').trim();
  if (!mediaUrls.length) {
    return sendWhatsAppSessionMessage({ to: options.to, body: text });
  }

  let lastResult: WhatsAppOutboundResult = { sent: false, reason: 'Falha ao enviar mídia' };
  for (let index = 0; index < mediaUrls.length; index += 1) {
    lastResult = await sendWhatsAppSessionMessage({
      to: options.to,
      body: index === 0 ? text : undefined,
      mediaUrl: mediaUrls[index],
    });
    if (!lastResult.sent) return lastResult;
  }
  return lastResult;
}
