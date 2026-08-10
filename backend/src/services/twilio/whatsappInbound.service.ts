/** whatsappInbound.service v1.3.0 — inbound + match waChatId canônico (E.164) */
import twilio from 'twilio';
import { env } from '../../config/env';
import { ChamadoN1 } from '../../models/ChamadoN1';
import { ChamadoIaAnalise } from '../../models/ChamadoIaAnalise';
import { shouldSpawnNewTicketOnInbound } from '../chamado.mapper';
import {
  getTwilioActiveAccountSid,
  getTwilioCredentialMode,
  isTwilioConfigured,
} from './twilioClient.util';
import { resolveWhatsAppStatusCallbackUrl } from './whatsappCallbackUrl.util';
import type { TwilioWhatsAppWebhookPayload } from './whatsappInbound.types';
import {
  appendWhatsAppMensagemToChamado,
  normalizeWaChatId,
  readWhatsAppMensagens,
  WHATSAPP_THREAD_SOURCE,
} from './whatsappThread.service';

const { MessagingResponse } = twilio.twiml;

function readField(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim();
}

export function parseTwilioWhatsAppWebhook(body: Record<string, unknown>): TwilioWhatsAppWebhookPayload {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (value == null) continue;
    raw[key] = String(value);
  }

  const numMediaRaw = readField(body, 'NumMedia');
  const numMedia = Number.parseInt(numMediaRaw || '0', 10);

  return {
    messageSid: readField(body, 'MessageSid') || readField(body, 'SmsMessageSid'),
    from: readField(body, 'From'),
    to: readField(body, 'To'),
    body: readField(body, 'Body'),
    numMedia: Number.isFinite(numMedia) ? Math.max(0, numMedia) : 0,
    profileName: readField(body, 'ProfileName'),
    waId: readField(body, 'WaId'),
    accountSid: readField(body, 'AccountSid'),
    raw,
  };
}

export function buildInboundTwimlReply(message?: string): string {
  const twiml = new MessagingResponse();
  const text = String(message ?? env.twilioWhatsappAutoReply).trim()
    || 'Message received! Hello again from the Twilio Sandbox for WhatsApp.';
  twiml.message(text);
  return twiml.toString();
}

function hasWhatsAppMessageSid(chamado: InstanceType<typeof ChamadoN1>, messageSid: string): boolean {
  if (!messageSid) return false;
  for (const reg of chamado.registro ?? []) {
    if (readWhatsAppMensagens(reg).some((item) => item.twilioMessageSid === messageSid)) {
      return true;
    }
  }
  return false;
}

export async function findChamadoForWhatsAppInbound(waFrom: string) {
  const digits = normalizeWaChatId(waFrom);
  if (!digits || digits.length < 8) return null;
  const suffix = digits.slice(-8);

  const candidates = await ChamadoN1.find({
    $or: [
      { 'registro.metadados.source': WHATSAPP_THREAD_SOURCE, 'registro.metadados.waChatId': { $regex: `${suffix}$` } },
      { 'registro.metadados.waFrom': { $regex: `${suffix}$` } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(8);

  for (const chamado of candidates) {
    if (!shouldSpawnNewTicketOnInbound(chamado)) {
      return chamado;
    }
  }

  return null;
}

export async function processInboundWhatsAppMessage(payload: TwilioWhatsAppWebhookPayload): Promise<void> {
  console.info('[whatsapp-inbound] mensagem recebida', {
    messageSid: payload.messageSid,
    from: payload.from,
    to: payload.to,
    profileName: payload.profileName || null,
    bodyPreview: payload.body.slice(0, 120) || '[sem texto]',
    numMedia: payload.numMedia,
  });

  const texto = String(payload.body ?? '').trim();
  if (!texto && payload.numMedia <= 0) return;

  const chamado = await findChamadoForWhatsAppInbound(payload.from);
  if (!chamado) {
    console.info('[whatsapp-inbound] nenhum ticket aberto para o número — mensagem ignorada', {
      from: payload.from,
    });
    return;
  }

  if (hasWhatsAppMessageSid(chamado, payload.messageSid)) {
    console.info('[whatsapp-inbound] mensagem duplicada ignorada', { messageSid: payload.messageSid });
    return;
  }

  const waChatId = normalizeWaChatId(payload.waId || payload.from);
  appendWhatsAppMensagemToChamado(chamado, {
    origin: 'cliente',
    autor: payload.profileName || waChatId,
    texto: texto || '[mídia recebida]',
    waChatId,
    twilioMessageSid: payload.messageSid || undefined,
  });

  await chamado.save();
  await ChamadoIaAnalise.updateOne(
    { chamadoId: chamado._id, origem: { $ne: 'manual' } },
    { $set: { needsReanalysis: true } },
  );

  console.info('[whatsapp-inbound] mensagem anexada ao ticket', {
    chamadoProtocolo: chamado.chamadoProtocolo,
    ticketId: chamado._id.toString(),
  });
}

export function getWhatsAppInboundHealth(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  return {
    status: 'ok' as const,
    enabled: env.whatsappInboundEnabled,
    provider: 'twilio',
    twilioConfigured: isTwilioConfigured(),
    twilioCredentialMode: getTwilioCredentialMode(),
    twilioAccountSid: getTwilioActiveAccountSid() || null,
    webhookUrl: `${normalizedBase}/api/inbound/whatsapp/messages`,
    statusCallbackUrl: resolveWhatsAppStatusCallbackUrl(normalizedBase) || null,
    sandboxFromDefault: env.twilioWhatsappFrom || 'whatsapp:+14155238886',
  };
}
