/** whatsappStatusCallback.service v1.0.0 — Status Callback Twilio → entrega na thread */
import { ChamadoN1 } from '../../models/ChamadoN1';
import {
  normalizeWhatsAppDeliveryStatus,
  updateWhatsAppMensagemDeliveryBySid,
  type WhatsAppDeliveryStatus,
} from './whatsappThread.service';

export interface TwilioMessageStatusPayload {
  messageSid: string;
  messageStatus: WhatsAppDeliveryStatus;
  errorCode?: string;
  errorMessage?: string;
  raw: Record<string, string>;
}

function readField(body: Record<string, unknown>, key: string): string {
  return String(body[key] ?? '').trim();
}

export function parseTwilioMessageStatusWebhook(body: Record<string, unknown>): TwilioMessageStatusPayload {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(body ?? {})) {
    if (value == null) continue;
    raw[key] = String(value);
  }

  return {
    messageSid: readField(body, 'MessageSid') || readField(body, 'SmsSid'),
    messageStatus: normalizeWhatsAppDeliveryStatus(readField(body, 'MessageStatus') || readField(body, 'SmsStatus')),
    errorCode: readField(body, 'ErrorCode') || undefined,
    errorMessage: readField(body, 'ErrorMessage') || undefined,
    raw,
  };
}

export async function findChamadoByTwilioMessageSid(messageSid: string) {
  const sid = String(messageSid ?? '').trim();
  if (!sid) return null;
  return ChamadoN1.findOne({
    'registro.metadados.whatsappMensagens.twilioMessageSid': sid,
  });
}

export interface ProcessWhatsAppStatusResult {
  updated: boolean;
  chamadoProtocolo?: string;
  ticketId?: string;
  deliveryStatus?: WhatsAppDeliveryStatus;
  reason?: string;
}

export async function processWhatsAppMessageStatusCallback(
  payload: TwilioMessageStatusPayload,
): Promise<ProcessWhatsAppStatusResult> {
  if (!payload.messageSid) {
    return { updated: false, reason: 'MessageSid ausente' };
  }

  const chamado = await findChamadoByTwilioMessageSid(payload.messageSid);
  if (!chamado) {
    console.info('[whatsapp-status] mensagem não vinculada a ticket', {
      messageSid: payload.messageSid,
      messageStatus: payload.messageStatus,
    });
    return { updated: false, reason: 'Ticket não encontrado para MessageSid' };
  }

  const applied = updateWhatsAppMensagemDeliveryBySid(chamado, payload.messageSid, {
    status: payload.messageStatus,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
  });

  if (!applied.updated) {
    return {
      updated: false,
      chamadoProtocolo: chamado.chamadoProtocolo,
      ticketId: chamado._id.toString(),
      reason: applied.reason ?? 'Status não aplicado',
    };
  }

  await chamado.save();

  console.info('[whatsapp-status] entrega atualizada', {
    messageSid: payload.messageSid,
    messageStatus: payload.messageStatus,
    chamadoProtocolo: chamado.chamadoProtocolo,
    ticketId: chamado._id.toString(),
  });

  return {
    updated: true,
    chamadoProtocolo: chamado.chamadoProtocolo,
    ticketId: chamado._id.toString(),
    deliveryStatus: applied.deliveryStatus,
  };
}
