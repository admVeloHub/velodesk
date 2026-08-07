/** whatsappOutbound.service v1.0.0 — envio Twilio WhatsApp (Sandbox + sessão 24h) */
import { getTwilioClient, getTwilioWhatsAppFrom, isTwilioConfigured } from './twilioClient.util';
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
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

/** Mensagem business-initiated via template (Sandbox quickstart). */
export async function sendWhatsAppSandboxTemplate(options: {
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
        1: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        2: new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }),
      }),
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

/** Mensagem free-form (janela de atendimento 24h após msg do cliente). */
export async function sendWhatsAppTextMessage(options: {
  to: string;
  body: string;
}): Promise<WhatsAppOutboundResult> {
  if (!isTwilioConfigured()) {
    return { sent: false, reason: 'Twilio não configurado' };
  }

  const to = normalizeWhatsAppAddress(options.to);
  const body = String(options.body ?? '').trim();
  if (!to || to === 'whatsapp:') {
    return { sent: false, reason: 'Destino inválido' };
  }
  if (!body) {
    return { sent: false, reason: 'Texto da mensagem é obrigatório' };
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      from: getTwilioWhatsAppFrom(),
      to,
      body,
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
