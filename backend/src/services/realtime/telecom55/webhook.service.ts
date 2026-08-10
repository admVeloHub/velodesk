/**
 * webhook.service — ingestão de eventos 55PBX (port de wfm_atendimento/app/api/webhooks/telecom55).
 */
import type { Request } from 'express';
import { env } from '../../../config/env';
import { getRealtimeSupabaseClient } from '../../../config/supabaseRealtime';
import { safeCompare } from '../../../utils/safeCompare';
import { queueByOriginPhone, queueDisplayName } from '../telephony/queueDisplay';
import { isCallTerminationPayload, rawCallStatus } from './webhookPayload';

type WebhookPayload = Record<string, unknown>;

const WAITING_STATUSES = new Set(['waiting', 'queue', 'queued', 'fila', 'em_espera', 'em espera', 'ringing', 'call_waiting', 'new_call']);
const TALKING_STATUSES = new Set(['answered', 'attended', 'atendida', 'talking', 'connected', 'in_call', 'em_atendimento', 'call_attended']);
const ENDED_STATUSES = new Set(['ended', 'finished', 'completed', 'hangup', 'hangup_call', 'cancelled', 'canceled']);
const ABANDONED_STATUSES = new Set(['abandoned', 'abandonada', 'abandonado']);

function pickString(payload: WebhookPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function normalizeText(value: string | null): string | null {
  if (!value) return null;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveStatus(payload: WebhookPayload): string {
  if (isCallTerminationPayload(payload)) {
    const normalized = rawCallStatus(payload);
    if (normalized.includes('abandon')) return 'abandoned';
    return 'ended';
  }

  const raw =
    pickString(payload, [
      'call_status',
      'status',
      'state',
      'event',
      'event_type',
      'type',
      'chamada',
      'callState',
      'call_state',
    ]) ?? 'unknown';
  const normalized = normalizeText(raw) ?? 'unknown';

  if (WAITING_STATUSES.has(normalized)) return 'waiting';
  if (TALKING_STATUSES.has(normalized)) return 'talking';
  if (ABANDONED_STATUSES.has(normalized) || normalized.includes('abandon')) return 'abandoned';
  if (
    ENDED_STATUSES.has(normalized) ||
    normalized.includes('hangup') ||
    normalized.includes('ended') ||
    normalized.includes('finished') ||
    normalized.includes('completed') ||
    normalized.includes('cancel')
  ) {
    return 'ended';
  }
  return normalized;
}

function parsePtBrDateTime(dateValue: string | null, timeValue: string | null): string | null {
  if (!dateValue) return null;
  const dateMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dateMatch) return parseDate(dateValue);

  const [, day, month, year] = dateMatch;
  const time = timeValue && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeValue) ? timeValue : '00:00:00';
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${normalizedTime}-03:00`).toISOString();
}

function resolveOccurredAt(payload: WebhookPayload): string {
  return (
    parseDate(
      pickString(payload, [
        'occurred_at',
        'timestamp',
        'created_at',
        'started_at',
        'start_time',
        'data_atendimento',
        'date',
      ]),
    ) ??
    parsePtBrDateTime(
      pickString(payload, ['call_date', 'data', 'Data']),
      pickString(payload, ['call_time', 'hora', 'Hora']),
    ) ??
    new Date().toISOString()
  );
}

export function isTelecom55WebhookAuthorized(req: Request, payload?: WebhookPayload): boolean {
  const secret = env.telecom55WebhookSecret;
  if (!secret) {
    if (env.nodeEnv === 'production') {
      console.error('[telecom55/webhook] TELECOM55_WEBHOOK_SECRET ausente em produção.');
      return false;
    }
    return true;
  }

  const authHeader = req.headers.authorization;
  const headerSecret = req.headers['x-webhook-secret'];
  const keyHeader = req.headers.key;
  const tokenHeader = req.headers.token;
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : null;
  const bodySecret = payload
    ? pickString(payload, ['key', 'chave', 'secret', 'token', 'webhook_secret'])
    : null;

  return (
    safeCompare(typeof authHeader === 'string' ? authHeader : null, `Bearer ${secret}`) ||
    safeCompare(typeof headerSecret === 'string' ? headerSecret : null, secret) ||
    safeCompare(typeof keyHeader === 'string' ? keyHeader : null, secret) ||
    safeCompare(typeof tokenHeader === 'string' ? tokenHeader : null, secret) ||
    safeCompare(querySecret, secret) ||
    safeCompare(bodySecret, secret)
  );
}

export async function processTelecom55Webhook(payload: WebhookPayload) {
  const supabase = getRealtimeSupabaseClient();

  const externalCallId = pickString(payload, [
    'call_id',
    'callId',
    'id_call',
    'idCall',
    'uniqueid',
    'unique_id',
    'linkedid',
    'id',
  ]);
  const externalEventId = pickString(payload, ['event_id', 'eventId', 'id_event', 'uuid']);
  const eventType = pickString(payload, ['event_type', 'event', 'type', 'call_type', 'call_status']);
  const callStatus = resolveStatus(payload);
  const occurredAt = resolveOccurredAt(payload);
  const originPhone = pickString(payload, ['call_number_input', 'telefone_entrada', 'Telefone Entrada', 'origin_phone', 'did']);
  const queueFromOriginPhone = queueByOriginPhone(originPhone);
  const queueId =
    pickString(payload, ['queue_id', 'queueId', 'id_queue', 'idQueue', 'wx_queue_id', 'call_queue_id']) ??
    queueFromOriginPhone?.externalId ??
    null;
  const queueName = queueDisplayName(
    pickString(payload, ['queue_name', 'queueName', 'fila', 'queue', 'call_queue']) ??
      queueFromOriginPhone?.name ??
      null,
    queueId,
  );
  const agentId = pickString(payload, [
    'agent_id',
    'agentId',
    'operator_id',
    'operatorId',
    'external_operator_id',
    'Wy_branch_mask_agent',
    'call_branch',
    'branch_mask',
  ]);
  const agentName = pickString(payload, [
    'agent_name',
    'agentName',
    'operator_name',
    'operatorName',
    'agent',
    'call_name',
    'call_branch_name',
    'branch_email',
  ]);

  const { error: eventError } = await supabase.from('telecom_webhook_events').insert({
    provider: '55pbx',
    external_event_id: externalEventId,
    external_call_id: externalCallId,
    event_type: eventType,
    call_status: callStatus,
    queue_id: queueId,
    queue_name: queueName,
    agent_id: agentId,
    agent_name: agentName,
    occurred_at: occurredAt,
    raw_payload: payload,
  });

  if (eventError) {
    throw new Error(eventError.message);
  }

  if (externalCallId) {
    const isWaiting = callStatus === 'waiting';
    const isTalking = callStatus === 'talking';
    const isEnded = callStatus === 'ended' || callStatus === 'abandoned';

    const { error: liveError } = await supabase.from('telecom_live_calls').upsert(
      {
        external_call_id: externalCallId,
        call_status: callStatus,
        queue_id: queueId,
        queue_name: queueName,
        agent_id: agentId,
        agent_name: agentName,
        started_at: isWaiting ? occurredAt : undefined,
        answered_at: isTalking ? occurredAt : undefined,
        ended_at: isEnded ? occurredAt : undefined,
        last_event_at: occurredAt,
        updated_at: new Date().toISOString(),
        raw_payload: payload,
      },
      { onConflict: 'external_call_id', ignoreDuplicates: false },
    );

    if (liveError) {
      throw new Error(liveError.message);
    }
  }

  return { externalCallId, callStatus };
}

export async function getTelecom55WebhookHealth() {
  const supabase = getRealtimeSupabaseClient();
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const start = `${today}T00:00:00-03:00`;
  const end = `${today}T23:59:59-03:00`;

  const [eventsToday, waitingCalls, liveCalls, latestEvents] = await Promise.all([
    supabase
      .from('telecom_webhook_events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', start)
      .lte('occurred_at', end),
    supabase
      .from('telecom_live_calls')
      .select('external_call_id', { count: 'exact', head: true })
      .eq('call_status', 'waiting'),
    supabase
      .from('telecom_live_calls')
      .select('external_call_id', { count: 'exact', head: true }),
    supabase
      .from('telecom_webhook_events')
      .select('received_at, occurred_at, event_type, call_status, external_call_id, queue_name, agent_id, raw_payload')
      .order('received_at', { ascending: false })
      .limit(5),
  ]);

  return {
    ok: !eventsToday.error && !waitingCalls.error && !liveCalls.error && !latestEvents.error,
    today,
    counts: {
      eventsToday: eventsToday.count ?? 0,
      waitingCalls: waitingCalls.count ?? 0,
      liveCalls: liveCalls.count ?? 0,
    },
    latestEvents: latestEvents.data ?? [],
    errors: {
      eventsToday: eventsToday.error?.message ?? null,
      waitingCalls: waitingCalls.error?.message ?? null,
      liveCalls: liveCalls.error?.message ?? null,
      latestEvents: latestEvents.error?.message ?? null,
    },
  };
}
