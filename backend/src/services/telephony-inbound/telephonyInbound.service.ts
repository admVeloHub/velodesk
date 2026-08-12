/** telephonyInbound.service v2.2.0 — auto-cria ticket + CTA sininho quando agente determinado */
import { TelephonyCall } from '../../models/TelephonyCall';
import { env } from '../../config/env';
import { findClienteByCpf, findClienteByPhone } from '../cliente.service';
import { parsePartnerTelephonyPayload } from './adapters/partner.adapter';
import { CONTACT_TEL_COMPLETED_FIXTURE } from './fixtures/contact-tel.fixture';
import { sanitizeTelephonyRawPayload } from './sanitizePayload';
import type { TelephonyCallInput, TelephonyInboundResult } from './types';
import { buildPartnerRecadosEnvelope } from '../telephonyRecado.service';
import {
  createTicketAndNotifyFromTelephonyCall,
  telephonyHasAssignedAgent,
} from '../telephonyTicketNotify.service';

async function resolveClienteId(input: TelephonyCallInput) {
  if (input.clientCpf) {
    const byCpf = await findClienteByCpf(input.clientCpf);
    if (byCpf?._id) return byCpf._id;
  }
  if (input.clientPhone) {
    const byPhone = await findClienteByPhone(input.clientPhone);
    if (byPhone?._id) return byPhone._id;
  }
  return null;
}

function buildCreatePayload(input: TelephonyCallInput, rawPayload: Record<string, unknown>) {
  return {
    externalCallId: input.externalCallId,
    provider: input.provider ?? 'contact-tel',
    canonicalUrl: input.canonicalUrl,
    direction: input.direction,
    origin: input.origin,
    callType: input.callType,
    status: input.status,
    initiatedAt: input.initiatedAt,
    answeredAt: input.answeredAt,
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? input.startedAt,
    durationSeconds: input.durationSeconds,
    ringDuration: input.ringDuration,
    clientPhone: input.clientPhone ?? '',
    clientCpf: input.clientCpf ?? '',
    clientName: input.clientName ?? '',
    isConverted: input.isConverted,
    isOptout: input.isOptout,
    isMismatch: input.isMismatch,
    terminationOrigin: input.terminationOrigin,
    agentId: input.agentId,
    agentName: input.agentName,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    variables: input.variables,
    dataCollected: input.dataCollected,
    transcript: input.transcript ?? '',
    summary: input.summary ?? '',
    transcriptFull: input.transcriptFull,
    transfer: input.transfer,
    outcome: input.outcome ?? input.status,
    intent: input.intent,
    sentiment: input.sentiment,
    rawPayload,
    ticketStatus: 'none' as const,
    chamadoId: null,
  };
}

export async function processInboundTelephonyCall(
  body: Record<string, unknown>,
): Promise<TelephonyInboundResult> {
  const input = parsePartnerTelephonyPayload(body);
  const existing = await TelephonyCall.findOne({ externalCallId: input.externalCallId }).lean();
  if (existing) {
    console.info('[telephony-inbound] duplicate externalCallId=%s', input.externalCallId);
    return {
      action: 'duplicate',
      callId: String(existing._id),
      externalCallId: input.externalCallId,
    };
  }

  const clienteId = await resolveClienteId(input);
  const rawPayload = sanitizeTelephonyRawPayload(body);
  const doc = await TelephonyCall.create({
    ...buildCreatePayload(input, rawPayload),
    clienteId,
  });

  if (env.chamadoIaAnaliseEnabled && (input.summary || input.transcript)) {
    void import('../telephonyIaAnalise.service')
      .then(({ classificarTelephonyCallPorId }) => classificarTelephonyCallPorId(String(doc._id)))
      .catch((err) => console.warn('[telephony-inbound] classificação IA falhou:', (err as Error).message));
  }

  if (env.telephonyAutoCreateTicket && telephonyHasAssignedAgent(input)) {
    try {
      const created = await createTicketAndNotifyFromTelephonyCall(doc, input);
      if (created) {
        console.info('[telephony-inbound] ticket criado e CTA notificado', created);
      }
    } catch (err) {
      console.warn('[telephony-inbound] auto-create ticket falhou:', (err as Error).message);
    }
  }

  console.info('[telephony-inbound] created externalCallId=%s callId=%s provider=%s status=%s',
    input.externalCallId, doc._id, input.provider ?? 'contact-tel', input.status ?? 'unknown');
  return {
    action: 'created',
    callId: String(doc._id),
    externalCallId: input.externalCallId,
  };
}

export async function getInboundTelephonyRecados() {
  return buildPartnerRecadosEnvelope();
}

export function getPartnerPayloadExample(): Record<string, unknown> {
  return CONTACT_TEL_COMPLETED_FIXTURE;
}
