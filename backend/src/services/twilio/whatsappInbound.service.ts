/** whatsappInbound.service v1.10.0 — janela 48h reabre; fechado gera ticket derivado */
import twilio from 'twilio';
import { env } from '../../config/env';
import { ChamadoN1 } from '../../models/ChamadoN1';
import { ChamadoIaAnalise } from '../../models/ChamadoIaAnalise';
import { publishTicketEvent } from '../realtime/ticketEventsBroadcast.service';
import {
  appendStatusTransition,
  createChamadoFromBody,
  currentStatus,
  normalizeStatusValue,
  resolveInboundClientReplyStatus,
  shouldSpawnNewTicketOnInbound,
  buildInboundDerivedTicketNote,
} from '../chamado.mapper';
import { runInboundPostCreateHooks } from '../agents/inboundAgentPipeline.service';
import {
  getTwilioActiveAccountSid,
  getTwilioCredentialMode,
  isTwilioConfigured,
} from './twilioClient.util';
import { resolveWhatsAppStatusCallbackUrl } from './whatsappCallbackUrl.util';
import type { TwilioWhatsAppWebhookPayload } from './whatsappInbound.types';
import {
  parseTwilioInboundMedia,
  persistTwilioInboundMedia,
  type PersistedTwilioInboundMedia,
} from './twilioMediaInbound.service';
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
  const normalizedNumMedia = Number.isFinite(numMedia) ? Math.max(0, numMedia) : 0;

  return {
    messageSid: readField(body, 'MessageSid') || readField(body, 'SmsMessageSid'),
    from: readField(body, 'From'),
    to: readField(body, 'To'),
    body: readField(body, 'Body'),
    numMedia: normalizedNumMedia,
    media: parseTwilioInboundMedia(raw, normalizedNumMedia),
    profileName: readField(body, 'ProfileName'),
    waId: readField(body, 'WaId'),
    accountSid: readField(body, 'AccountSid'),
    raw,
  };
}

export function buildInboundTwimlReply(message?: string): string {
  const twiml = new MessagingResponse();
  const configured = message !== undefined
    ? String(message).trim()
    : String(env.twilioWhatsappAutoReply ?? '').trim();
  if (!configured) {
    return twiml.toString();
  }
  twiml.message(configured);
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

async function listChamadosForWhatsAppInbound(waFrom: string) {
  const digits = normalizeWaChatId(waFrom);
  if (!digits || digits.length < 8) return [];
  const suffix = digits.slice(-8);

  return ChamadoN1.find({
    $or: [
      { 'registro.metadados.source': WHATSAPP_THREAD_SOURCE, 'registro.metadados.waChatId': { $regex: `${suffix}$` } },
      { 'registro.metadados.waChatId': { $regex: `${suffix}$` } },
      { 'registro.metadados.waFrom': { $regex: `${suffix}$` } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(30);
}

export async function findChamadoForWhatsAppInbound(waFrom: string) {
  const candidates = await listChamadosForWhatsAppInbound(waFrom);
  return candidates.find((chamado) => !shouldSpawnNewTicketOnInbound(chamado)) || null;
}

function appendInboundWhatsAppToChamado(
  chamado: InstanceType<typeof ChamadoN1>,
  payload: TwilioWhatsAppWebhookPayload,
  storedMedia: PersistedTwilioInboundMedia[],
): string {
  const texto = String(payload.body ?? '').trim();
  const attachmentUrls = storedMedia.map((item) => item.url);
  const mediaContentTypes = storedMedia.map((item) => item.contentType);
  const anexosScanStatus = storedMedia.map((item) => item.scanStatus);
  const hasAudio = mediaContentTypes.some((value) => value.toLowerCase().startsWith('audio/'));
  const waChatId = normalizeWaChatId(payload.waId || payload.from);
  appendWhatsAppMensagemToChamado(chamado, {
    origin: 'cliente',
    autor: payload.profileName || waChatId,
    texto: texto || (hasAudio ? '[Áudio recebido]' : '[Mídia recebida]'),
    anexos: attachmentUrls,
    waChatId,
    twilioMessageSid: payload.messageSid || undefined,
    mediaContentTypes,
    anexosScanStatus,
    transcriptionStatus: hasAudio ? 'available' : undefined,
  });
  return waChatId;
}

async function saveWhatsAppReplyOnChamado(
  chamado: InstanceType<typeof ChamadoN1>,
  payload: TwilioWhatsAppWebhookPayload,
  storedMedia: PersistedTwilioInboundMedia[],
): Promise<void> {
  const waChatId = appendInboundWhatsAppToChamado(chamado, payload, storedMedia);
  const reopenStatus = resolveInboundClientReplyStatus(chamado);
  if (reopenStatus && reopenStatus !== normalizeStatusValue(currentStatus(chamado))) {
    appendStatusTransition(chamado, reopenStatus, {
      origin: 'cliente',
      autor: payload.profileName || waChatId,
      metadados: { trigger: 'whatsapp-inbound-reply' },
    });
  }
  chamado.markModified('registro');
  await chamado.save();
  void publishTicketEvent(chamado._id.toString(), 'whatsapp-inbound');
  await ChamadoIaAnalise.updateOne(
    { chamadoId: chamado._id, origem: { $ne: 'manual' } },
    { $set: { needsReanalysis: true } },
  );
}

async function createDerivedWhatsAppChamado(
  source: InstanceType<typeof ChamadoN1>,
  payload: TwilioWhatsAppWebhookPayload,
  storedMedia: PersistedTwilioInboundMedia[],
): Promise<InstanceType<typeof ChamadoN1>> {
  const waChatId = normalizeWaChatId(payload.waId || payload.from);
  const tab = source.tabulacao?.[source.tabulacao.length - 1];
  const clientRef = source.cliente?.[0];
  const ticketBody: Record<string, unknown> = {
    title: source.chamadoTitulo || `WhatsApp ${waChatId}`,
    chamadoTitulo: source.chamadoTitulo || `WhatsApp ${waChatId}`,
    text: buildInboundDerivedTicketNote(source.chamadoProtocolo),
    internal: true,
    status: 'novo',
    clientName: payload.profileName || waChatId,
    source: 'whatsapp-thread',
    channel: 'whatsapp',
    messageOrigin: 'agente',
    lateralForm: {
      canal: tab?.canal || 'WhatsApp',
      clienteNome: payload.profileName || '',
      responsavel: tab?.responsavel || '',
      atribuido: tab?.atribuido || '',
      produto: tab?.produto || '',
      motivo: tab?.motivo || source.chamadoTitulo || '',
      detalhe: tab?.detalhe || '',
      tipoChamado: tab?.tipoChamado || '',
    },
  };
  if (clientRef?.clienteId) ticketBody.clienteId = clientRef.clienteId.toString();
  if (clientRef?.clienteCpf) ticketBody.clientCPF = clientRef.clienteCpf;

  const partial = await createChamadoFromBody(ticketBody, 'novo');
  if (source.cliente?.length && (!partial.cliente || partial.cliente.length === 0)) {
    partial.cliente = source.cliente;
  }
  if (partial.registro?.[0]) {
    partial.registro[0].metadados = {
      ...(partial.registro[0].metadados ?? {}),
      trigger: 'inbound-derived-ticket',
      sourceProtocolo: String(source.chamadoProtocolo ?? '').trim(),
    };
  }

  const chamado = await ChamadoN1.create(partial);
  appendInboundWhatsAppToChamado(chamado, payload, storedMedia);
  chamado.markModified('registro');
  await chamado.save();
  void publishTicketEvent(chamado._id.toString(), 'whatsapp-inbound');
  void runInboundPostCreateHooks(chamado, { source: 'whatsapp-inbound' }).catch((err: Error) => {
    console.warn('[whatsapp-inbound] hooks inbound fail-soft:', err.message);
  });
  return chamado;
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

  const candidates = await listChamadosForWhatsAppInbound(payload.from);
  if (payload.messageSid && candidates.some((item) => hasWhatsAppMessageSid(item, payload.messageSid))) {
    console.info('[whatsapp-inbound] mensagem duplicada ignorada', { messageSid: payload.messageSid });
    return;
  }

  const storedMedia = payload.media.length
    ? await persistTwilioInboundMedia(payload.messageSid, payload.accountSid, payload.media)
    : [];

  const reopenable = candidates.find((chamado) => !shouldSpawnNewTicketOnInbound(chamado));
  if (reopenable) {
    await saveWhatsAppReplyOnChamado(reopenable, payload, storedMedia);
    console.info('[whatsapp-inbound] mensagem anexada ao ticket', {
      chamadoProtocolo: reopenable.chamadoProtocolo,
      ticketId: reopenable._id.toString(),
      attachments: storedMedia.length,
    });
    return;
  }

  const source = candidates[0];
  if (source) {
    const derived = await createDerivedWhatsAppChamado(source, payload, storedMedia);
    console.info('[whatsapp-inbound] ticket derivado criado', {
      origemProtocolo: source.chamadoProtocolo,
      chamadoProtocolo: derived.chamadoProtocolo,
      ticketId: derived._id.toString(),
    });
    return;
  }

  console.info('[whatsapp-inbound] nenhum ticket para o número — mensagem ignorada', {
    from: payload.from,
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
