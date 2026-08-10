import type { SupabaseClient } from '@supabase/supabase-js';
import {
  brasiliaDayBoundsUtc,
  compareEventWallClock,
  minutesFromEventStoredWallClock,
  parseTimeToMinutes,
  weekdayBrazil,
} from '../dates/brasilDay';
import { queueDisplayName, isExcludedDashboardQueue } from '../telephony/queueDisplay';
import {
  computeTelephonyBreakdown,
  computeLeticiaTalkSummary,
  isRetainedUra,
  isCallAttended,
  isAbandoned,
  SEM_FILA_BUCKET_LABEL,
  type CallRawFullRow,
  type QueueBreakdownRow,
} from '../telephony/breakdown';
export type { QueueBreakdownRow } from '../telephony/breakdown';
export { LETICIA_BUCKET_LABEL } from '../telephony/breakdown';
import type { LiveCallInProgress } from './liveCalls';
import {
  isAgentEngagedPayload,
  isCallFinalizationPayload,
} from '../telecom55/webhookPayload';

export type { LiveCallInProgress } from './liveCalls';

export type RealtimeSupabaseClient = SupabaseClient;

/**
 * Métricas "hoje" de Telefonia + Tickets (Octadesk) + Aderência dos colaboradores — extraídas
 * de `src/app/telao/page.tsx` (o telão/wallboard) para serem compartilhadas com o Dashboard
 * Gerencial (`/dashboard-gerencial`), que mostra os mesmos números dentro do layout normal do
 * app (com sidebar), em vez do modo tela cheia. Qualquer ajuste de REGRA de negócio aqui afeta
 * as duas páginas — ajustes só de LAYOUT/estilo ficam em cada página separadamente.
 */

type CallRow = {
  chamada: string | null;
  status?: string | null;
  wait_time_sec: number | null;
  talk_time_sec: number | null;
  humor_cliente?: string | number | null;
  qualidade_ligacao?: string | number | null;
  raw_payload: Record<string, unknown> | null;
};

/** @deprecated alias interno — usar CallRawFullRow de @/lib/telephony/breakdown */
type CallRawFullRowLocal = CallRawFullRow;

type TelecomWebhookEvent = {
  external_call_id: string | null;
  event_type: string | null;
  call_status: string | null;
  agent_id: string | null;
  occurred_at: string;
  raw_payload: Record<string, unknown> | null;
};

type OperatorEvent = {
  operator_id: string | null;
  external_operator_id: string | null;
  event_type: string;
  started_at: string;
  raw_payload: Record<string, unknown> | null;
};

type ScaleEvent = {
  operator_id: string | null;
  branch: string | null;
  event: string | null;
  time_at: string | null;
  hour_start: string | null;
  raw_payload: Record<string, unknown> | null;
};


export type TelephonyMetrics = {
  total: number;
  atendidas: number;
  abandonadas: number;
  emEspera: number;
  /** Quebra por fila de quem está esperando AGORA (só via webhook — ver `computeCurrentWaiting`). */
  emEsperaPorFila: BreakdownItem[];
  tmaSec: number | null;
  maxWaitSec: number | null;
  maxTalkSec: number | null;
  notaAtendente: number | null;
  notaSolucao: number | null;
  /** Ligações retidas na URA hoje (calls_raw), já descontando as pareadas com a Letícia (ver `computeTelephonyBreakdown`). */
  retidasUra: number;
  /** Ligações "Atendida" redirecionadas para a IA de voz Letícia (fila contém "redirecionamento" + Operador é um telefone da IA). */
  leticia: number;
  /** Segundos falados hoje pela Letícia IA (soma de talk_time_sec das ligações redirecionadas) — usado para "minutos usados". */
  leticiaTalkSec: number;
  /** Top 4 filas por volume hoje + agregado "Outras" (e "Sem fila" para retidas na URA sem fila) — só disponível quando a fonte é `calls_raw`. */
  porFila: QueueBreakdownRow[];
};

export type TicketMetrics = {
  total: number;
  novo: number;
  andamento: number;
  pendente: number;
  resolvido: number;
  cancelado: number;
  /** TMA em tempo de calendário (mantido por compatibilidade). Ver tmaUteisMin para horas úteis. */
  tmaMin: number | null;
  satisfacao: number | null;
  satisfacaoLabel: string;
  /** Tickets "Novo" hoje, quebrado por canal (Telefone, Letícia IA, Bot, App, E-mail, Formulário...). */
  novoPorCanal: BreakdownItem[];
  /** Novo + Pendente + Em andamento, consulta ao vivo na API do Octadesk (fila real, sem filtro de data). */
  totalATratar: number | null;
  totalATratarIndisponivel: boolean;
  /** TMA em horas úteis (seg-sex, 08h-19h) — abertura até resolução. */
  tmaUteisMin: number | null;
  tmaUteisPorCanal: BreakdownItem[];
  /** Tempo médio até a 1ª resposta humana, em horas úteis. */
  primeiraRespostaUteisMin: number | null;
  /** Quando TMA/1ª resposta foram recalculados pela última vez (só na sincronização completa). */
  ultimaAtualizacaoTempos: string | null;
};

export type AdherenceEmployee = { id: string; nome: string; chamadas?: number };

export type AdherenceMetrics = {
  escalados: number;
  logados: number;
  noHorario: number;
  atrasados: number;
  ausentes: number;
  folgaFora: number;
  /** Nomes de colaboradores por card — para exibição retrátil na UI (ver `getAdherenceMetrics`). */
  escaladosNomes: AdherenceEmployee[];
  logadosNomes: AdherenceEmployee[];
  noHorarioNomes: AdherenceEmployee[];
  atrasadosNomes: AdherenceEmployee[];
  ausentesNomes: AdherenceEmployee[];
  folgaForaNomes: AdherenceEmployee[];
};

const GRACE_MIN = 5;
const WAITING_STALE_SECONDS = 90;

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "Atualizado às HH:mm" para os cards de TMA/1ª resposta, que só recalculam na sync completa. */
export function formatAtualizadoAs(iso: string | null): string {
  if (!iso) return 'Ainda não calculado';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Ainda não calculado';
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `Atualizado às ${hora}`;
}

export function formatTicketTma(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return '--';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDecimal(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '--' : value.toFixed(2);
}

export type BreakdownItem = { label: string; value: string; pct?: number };

/** Top filas por contagem (Processadas/Atendidas/Abandonadas), com % do total do card. */
export function breakdownByCount(
  rows: QueueBreakdownRow[],
  key: 'total' | 'atendidas' | 'abandonadas',
  totalForPct?: number,
  limit = 4
): BreakdownItem[] {
  return rows
    .filter((row) => row[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, limit)
    .map((row) => ({
      label: row.label,
      value: String(row[key]),
      pct: totalForPct ? Math.round((row[key] / totalForPct) * 100) : undefined,
    }));
}

/** Top filas por duração (TMA/máx. espera/máx. chamada) — sem %, valor já formatado (hh:mm:ss). */
export function breakdownByDuration(
  rows: QueueBreakdownRow[],
  key: 'tmaSec' | 'maxWaitSec' | 'maxTalkSec',
  limit = 4
): BreakdownItem[] {
  return rows
    .filter((row) => row[key] != null)
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, limit)
    .map((row) => ({ label: row.label, value: formatDuration(row[key]) }));
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function webhookCallKey(event: TelecomWebhookEvent, index: number): string {
  return event.external_call_id ?? `event-${index}`;
}

function rawWebhookCallStatus(event: TelecomWebhookEvent): string {
  return normalizeStatus(
    String(
      event.raw_payload?.call_status ??
        event.raw_payload?.status ??
        event.raw_payload?.event ??
        event.call_status ??
        event.event_type ??
        ''
    )
  );
}

function isWebhookWaitingInQueue(event: TelecomWebhookEvent): boolean {
  const status = rawWebhookCallStatus(event);
  return status === 'call_waiting' || status === 'waiting' || status === 'em_espera';
}

function isWebhookCallEnded(event: TelecomWebhookEvent): boolean {
  return isCallFinalizationPayload(event.raw_payload ?? {});
}

function isWebhookEndedByRawStatus(event: TelecomWebhookEvent): boolean {
  const status = rawWebhookCallStatus(event);
  return (
    status.includes('attended') ||
    status.includes('answered') ||
    status.includes('talking') ||
    status.includes('connected') ||
    status.includes('abandon') ||
    status.includes('ended') ||
    status.includes('finished') ||
    status.includes('completed') ||
    status.includes('hangup') ||
    status.includes('cancel')
  );
}

function isWebhookQueueExitSignal(event: TelecomWebhookEvent): boolean {
  if (rawWebhookCallStatus(event) !== 'new_call') return false;
  const payload = event.raw_payload ?? {};
  return Boolean(
    String(payload.branch_mask ?? '').trim() ||
      String(payload.call_ura ?? '').trim() ||
      String(payload.call_queue ?? '').trim()
  );
}

/** Nome da fila no momento em que o evento marcou a ligação como "esperando" — mesmo campo (`call_queue`) usado no manual da 55PBX. */
function webhookQueueLabel(event: TelecomWebhookEvent): string {
  const raw = String(event.raw_payload?.call_queue ?? '').trim();
  return raw ? queueDisplayName(raw, null) : SEM_FILA_BUCKET_LABEL;
}

/** Total de quem está esperando AGORA + quebra por fila, a partir dos eventos de webhook de hoje. */
function computeCurrentWaiting(events: TelecomWebhookEvent[]): { total: number; porFila: BreakdownItem[] } {
  const state = new Map<string, { waiting: boolean; lastWaitingAt: number; queueLabel: string }>();

  events.forEach((event, index) => {
    const key = webhookCallKey(event, index);

    if (isWebhookWaitingInQueue(event)) {
      const t = new Date(event.occurred_at).getTime();
      if (Number.isFinite(t)) {
        state.set(key, { waiting: true, lastWaitingAt: t, queueLabel: webhookQueueLabel(event) });
      }
      return;
    }

    // "new_call" não cria espera. Quando vem depois de call_waiting com ramal/URA/fila,
    // indica que a chamada saiu da fila e foi encaminhada/tocou para atendimento.
    if (isWebhookCallEnded(event) || isWebhookEndedByRawStatus(event) || isWebhookQueueExitSignal(event)) {
      const current = state.get(key);
      if (current) state.set(key, { ...current, waiting: false });
    }
  });

  const cutoff = Date.now() - WAITING_STALE_SECONDS * 1000;
  const waitingNow = [...state.values()].filter((item) => item.waiting && item.lastWaitingAt >= cutoff);

  const byQueue = new Map<string, number>();
  for (const item of waitingNow) {
    byQueue.set(item.queueLabel, (byQueue.get(item.queueLabel) ?? 0) + 1);
  }
  const porFila = [...byQueue.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: String(value) }));

  return { total: waitingNow.length, porFila };
}

function webhookAgentIdFromEvent(event: TelecomWebhookEvent): string | null {
  const payload = event.raw_payload ?? {};
  return (
    String(
      payload.branch_mask ??
        payload.branchMask ??
        payload.Wy_branch_mask_agent ??
        payload.agent_id ??
        payload.agentId ??
        event.agent_id ??
        '',
    ).trim() || null
  );
}

function webhookAgentNameFromEvent(event: TelecomWebhookEvent): string | null {
  const payload = event.raw_payload ?? {};
  return (
    String(
      payload.branch_email ??
        payload.branchEmail ??
        payload.agent_name ??
        payload.agentName ??
        payload.call_name ??
        payload.call_branch_name ??
        '',
    ).trim() || null
  );
}

type TalkingCallState = {
  talking: boolean;
  answeredAtMs: number;
  agentId: string | null;
  agentName: string | null;
  queueLabel: string;
};

/** Replay do dia: agente em `new_call`/`call_waiting` liga; push final (`call_attended`+disc) desliga. */
function computeCurrentTalking(
  events: TelecomWebhookEvent[],
): Array<TalkingCallState & { callId: string }> {
  const state = new Map<string, TalkingCallState>();

  for (const event of events) {
    const callId = event.external_call_id?.trim();
    if (!callId) continue;

    const occurredMs = new Date(event.occurred_at).getTime();
    if (!Number.isFinite(occurredMs)) continue;

    const payload = event.raw_payload ?? {};

    if (isCallFinalizationPayload(payload)) {
      const current = state.get(callId);
      if (current) state.set(callId, { ...current, talking: false });
      continue;
    }

    if (isAgentEngagedPayload(payload, event.agent_id)) {
      state.set(callId, {
        talking: true,
        answeredAtMs: occurredMs,
        agentId: webhookAgentIdFromEvent(event),
        agentName: webhookAgentNameFromEvent(event),
        queueLabel: webhookQueueLabel(event),
      });
    }
  }

  return [...state.entries()]
    .filter(([, item]) => item.talking)
    .map(([callId, item]) => ({ callId, ...item }));
}

function liveCallAgentLabel(
  agentName: string | null,
  agentId: string | null,
  operatorNames: Map<string, string>,
): string {
  const extId = agentId?.trim() ?? '';
  if (extId && operatorNames.has(extId)) return operatorNames.get(extId)!;

  const name = agentName?.trim();
  if (name && !name.includes('@')) return name;
  if (name?.includes('@')) {
    return name
      .split('@')[0]
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (extId) return `Ramal ${extId}`;
  return 'Sem atendente';
}

/** Chamadas em atendimento agora — último evento webhook do dia é `call_attended` (sem `call_abandoned` depois). */
export async function getLiveCallsInProgress(
  supabase: RealtimeSupabaseClient,
  todayStr: string,
  now = new Date(),
): Promise<LiveCallInProgress[]> {
  const dayStart = `${todayStr}T00:00:00-03:00`;
  const dayEnd = `${todayStr}T23:59:59-03:00`;

  const events = await fetchAllPages<TelecomWebhookEvent>((from, to) =>
    supabase
      .from('telecom_webhook_events')
      .select('external_call_id, event_type, call_status, agent_id, occurred_at, raw_payload')
      .gte('occurred_at', dayStart)
      .lte('occurred_at', dayEnd)
      .order('occurred_at', { ascending: true })
      .range(from, to)
  );

  const talking = computeCurrentTalking(events);

  const { data: liveRows } = await supabase
    .from('telecom_live_calls')
    .select('external_call_id, queue_name, agent_id, agent_name, answered_at, last_event_at')
    .eq('call_status', 'talking')
    .is('ended_at', null)
    .gte('last_event_at', dayStart)
    .lte('last_event_at', dayEnd);

  const mergedTalking = [...talking];
  const seenIds = new Set(talking.map((call) => call.callId));
  for (const row of liveRows ?? []) {
    const callId = row.external_call_id?.trim();
    if (!callId || seenIds.has(callId)) continue;
    const answeredAtMs = row.answered_at ? new Date(String(row.answered_at)).getTime() : NaN;
    if (!Number.isFinite(answeredAtMs)) continue;
    mergedTalking.push({
      callId,
      talking: true,
      answeredAtMs,
      agentId: row.agent_id?.trim() || null,
      agentName: row.agent_name?.trim() || null,
      queueLabel: row.queue_name ? queueDisplayName(row.queue_name, null) : SEM_FILA_BUCKET_LABEL,
    });
    seenIds.add(callId);
  }

  if (mergedTalking.length === 0) return [];

  const agentIds = [
    ...new Set(mergedTalking.map((call) => call.agentId?.trim()).filter((id): id is string => Boolean(id))),
  ];
  const operatorNames = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: operators } = await supabase
      .from('operators')
      .select('external_id, name')
      .in('external_id', agentIds)
      .is('deleted_at', null);
    for (const operator of operators ?? []) {
      const key = String(operator.external_id ?? '').trim();
      const label = String(operator.name ?? '').trim();
      if (key && label) operatorNames.set(key, label);
    }
  }

  const nowMs = now.getTime();
  return mergedTalking
    .filter((call) => call.talking)
    .sort((a, b) => a.answeredAtMs - b.answeredAtMs)
    .map((call) => ({
      callId: call.callId,
      agentLabel: liveCallAgentLabel(call.agentName, call.agentId, operatorNames),
      queueLabel: call.queueLabel,
      answeredAtIso: new Date(call.answeredAtMs).toISOString(),
      durationSec: Math.max(0, Math.floor((nowMs - call.answeredAtMs) / 1000)),
    }));
}

function extractSurveyValue(call: CallRow, type: 'atendente' | 'solucao'): number | null {
  const rawValue = type === 'atendente'
    ? call.raw_payload?.['wh_question_2_1_PERGUNTA_ATENDENTE'] ?? call.raw_payload?.['Pergunta2 1 PERGUNTA ATENDENTE'] ?? call.humor_cliente
    : call.raw_payload?.['wh_question_2_2_PERGUNTA_SOLUCAO'] ?? call.raw_payload?.['Pergunta2 2 PERGUNTA SOLUCAO'] ?? call.qualidade_ligacao;

  if (rawValue == null) return null;
  const text = String(rawValue).trim().replace(',', '.');
  if (!text || text.toLowerCase() === 'abandonada') return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 1 && number <= 5 ? number : null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function monthBoundsFromDate(dateStr: string): { start: string; nextStart: string } {
  const [yearText, monthText] = dateStr.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return {
    start: `${yearText}-${monthText}-01`,
    nextStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

function surveyKeyLooksRelevant(key: string): boolean {
  const normalized = normalizeStatus(key);
  return (
    normalized.includes('survey') ||
    normalized.includes('review') ||
    normalized.includes('rating') ||
    normalized.includes('satisf') ||
    normalized.includes('avali') ||
    normalized.includes('nota') ||
    normalized.includes('csat')
  );
}

function parseScore(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(numeric) && numeric >= 1 && numeric <= 5 ? numeric : null;
}

function scaleEventLabel(event: ScaleEvent): string {
  return normalizeStatus(
    [
      event.event,
      event.raw_payload?.Atividade,
      event.raw_payload?.atividade,
      event.raw_payload?.event,
      event.raw_payload?.Event,
      event.raw_payload?.type,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function eventExternalId(event: OperatorEvent): string | null {
  return (
    event.external_operator_id?.trim() ||
    String(
      event.raw_payload?.Wy_branch_mask_agent ??
      event.raw_payload?.wy_branch_mask_agent ??
      event.raw_payload?.branch ??
      ''
    ).trim() ||
    null
  );
}

function scaleExternalId(event: ScaleEvent): string | null {
  return (
    event.branch?.trim() ||
    String(
      event.raw_payload?.Wy_branch_mask_agent ??
      event.raw_payload?.wy_branch_mask_agent ??
      event.raw_payload?.branch ??
      ''
    ).trim() ||
    null
  );
}

function isScaleOnline(event: ScaleEvent): boolean {
  const label = scaleEventLabel(event);
  return label.includes('online') || label.includes('logon') || label.includes('login');
}

function isScaleLoggedOut(event: ScaleEvent): boolean {
  const label = scaleEventLabel(event);
  return (
    label.includes('offline') ||
    label.includes('logoff') ||
    label.includes('logout') ||
    label.includes('deslog') ||
    label.includes('saida')
  );
}

function scaleEventTime(event: ScaleEvent): string | null {
  return event.time_at ?? event.hour_start ?? null;
}

function findSurveyScores(payload: unknown, parentKey = ''): number[] {
  if (!payload || typeof payload !== 'object') return [];

  const scores: number[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const relevant = surveyKeyLooksRelevant(`${parentKey} ${key}`);
    if (relevant) {
      const score = parseScore(value);
      if (score !== null) scores.push(score);
    }

    if (value && typeof value === 'object') {
      scores.push(...findSurveyScores(value, relevant ? key : parentKey));
    }
  }

  return scores;
}

async function fetchAllPages<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await makeQuery(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchTodayCallsRawFull(supabase: RealtimeSupabaseClient, todayStr: string): Promise<CallRawFullRow[]> {
  const startLocal = `${todayStr}T00:00:00`;
  const endLocal = `${todayStr}T23:59:59`;
  const rows = await fetchAllPages<CallRawFullRow>((from, to) =>
    supabase
      .from('calls_raw')
      .select(
        'call_id, chamada, status, wait_time_sec, talk_time_sec, humor_cliente, qualidade_ligacao, raw_payload, queue_name, wx_queue_id, operador, customer_number, numero, ddd, pais, started_at'
      )
      .or(`and(started_at.gte.${startLocal},started_at.lte.${endLocal}),and(data_atendimento.gte.${startLocal},data_atendimento.lte.${endLocal})`)
      .order('started_at', { ascending: true })
      .range(from, to)
  );

  // Filtro de "ativo/ramal/cobrança" em JS (não no SQL): `.not('queue_name','in',(...))` no
  // PostgREST exclui, por semântica de NULL, TAMBÉM as linhas com queue_name NULL — que é
  // justamente o caso das Retidas-na-URA (nunca chegam a uma fila). Usar `isExcludedDashboardQueue`
  // (mesma regra usada no dashboard histórico) evita esse bug e mantém as retidas na contagem.
  return rows.filter((row) => !isExcludedDashboardQueue(row.queue_name));
}

/**
 * Fonte única de verdade para os totais do dia: `calls_raw` (relatório da 55PBX), resincronizado
 * a cada ~1-2min pelo auto-refresh do painel (`realtime-calls-sync`). O webhook em tempo real
 * (`telecom_webhook_events`) NÃO é usado aqui — ver `getTelephonyMetrics` para o porquê.
 */
export async function getTelephonyMetrics(supabase: RealtimeSupabaseClient, todayStr: string): Promise<TelephonyMetrics> {
  // O relatório da 55PBX (`calls_raw`) só lista chamadas já finalizadas — por isso é a fonte de
  // total/atendidas/abandonadas/TMA/retidasUra/leticia/porFila (dia inteiro, uma fonte só, sem
  // depender do webhook estar de pé desde a meia-noite). O webhook em tempo real é usado só para
  // `emEspera` (quem está na fila AGORA), que é o único dado que o relatório em lote não tem —
  // ver histórico do incidente em docs/WEBHOOK_55PBX.md.
  const webhookEvents = await fetchAllPages<TelecomWebhookEvent>((from, to) =>
    supabase
      .from('telecom_webhook_events')
      .select('external_call_id, event_type, call_status, agent_id, occurred_at, raw_payload')
      .gte('occurred_at', `${todayStr}T00:00:00-03:00`)
      .lte('occurred_at', `${todayStr}T23:59:59-03:00`)
      .order('occurred_at', { ascending: true })
      .range(from, to)
  );
  const waiting = computeCurrentWaiting(webhookEvents);

  const calls = await fetchTodayCallsRawFull(supabase, todayStr);
  const breakdown = computeTelephonyBreakdown(calls);
  const leticiaTalk = computeLeticiaTalkSummary(calls);

  // Retidas-na-URA pareadas com a Letícia (mesma ligação registrada 2x pelo 55PBX) saem do total
  // — `breakdown.retidasUra` já é o número pós-exclusão; a diferença para o bruto é quantas pares saíram.
  const rawRetainedCount = calls.filter((call) => isRetainedUra(call.chamada)).length;
  const pairedExcludedCount = Math.max(0, rawRetainedCount - breakdown.retidasUra);
  const attendedCalls = calls.filter(isCallAttended);
  const total = calls.length - pairedExcludedCount;
  const atendidas = attendedCalls.length;
  const abandonadas = calls.filter((call) => isAbandoned(call.chamada)).length;

  const talkTimes = attendedCalls.map((call) => Number(call.talk_time_sec)).filter(Number.isFinite);
  const maxWaitSec = attendedCalls.reduce<number | null>(
    (max, call) => Math.max(max ?? 0, Number(call.wait_time_sec ?? 0)),
    null
  );
  const maxTalkSec = attendedCalls.reduce<number | null>(
    (max, call) => Math.max(max ?? 0, Number(call.talk_time_sec ?? 0)),
    null
  );
  const notasAtendente = attendedCalls
    .map((call) => extractSurveyValue(call, 'atendente'))
    .filter((value): value is number => value !== null);
  const notasSolucao = attendedCalls
    .map((call) => extractSurveyValue(call, 'solucao'))
    .filter((value): value is number => value !== null);

  return {
    total,
    atendidas,
    abandonadas,
    emEspera: waiting.total,
    emEsperaPorFila: waiting.porFila,
    tmaSec: talkTimes.length ? Math.round(talkTimes.reduce((a, b) => a + b, 0) / talkTimes.length) : null,
    maxWaitSec,
    maxTalkSec,
    notaAtendente: average(notasAtendente),
    notaSolucao: average(notasSolucao),
    retidasUra: breakdown.retidasUra,
    leticia: breakdown.leticia,
    leticiaTalkSec: leticiaTalk.talkSec,
    porFila: breakdown.porFila,
  };
}

/** Agrupa rótulos de canal em contagem + % do total (para "Novo por canal"). */
function countByCanal(labels: string[]): BreakdownItem[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const total = labels.length;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value: String(value),
      pct: total ? Math.round((value / total) * 100) : undefined,
    }));
}

/** Agrupa minutos (TMA em horas úteis) por canal, ordenado por volume de tickets. */
function averageMinutesByCanal(rows: Array<{ label: string; minutes: number }>): BreakdownItem[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (!map.has(row.label)) map.set(row.label, []);
    map.get(row.label)!.push(row.minutes);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, values]) => ({ label, value: formatTicketTma(average(values)) }));
}

function expectedEntryForDay(
  entryTime: string,
  weekly: Array<{ day_of_week: number; entry_time: string; active: boolean }>,
  dow: number
): { expediente: boolean; entrada: string | null } {
  const row = weekly.find((schedule) => schedule.day_of_week === dow);
  if (row) {
    if (!row.active) return { expediente: false, entrada: null };
    return { expediente: true, entrada: String(row.entry_time).slice(0, 5) };
  }
  if (dow >= 1 && dow <= 5) {
    return { expediente: true, entrada: String(entryTime).slice(0, 5) };
  }
  return { expediente: false, entrada: null };
}

export async function getAdherenceMetrics(supabase: RealtimeSupabaseClient, todayStr: string): Promise<AdherenceMetrics> {
  // Só considera operadores tipo "Online" — exclui "Suporte" (mesmo critério já usado no Ranking).
  const { data: operatorsRaw } = await supabase
    .from('operators')
    .select('id, name, external_id, entry_time')
    .is('deleted_at', null)
    .eq('status', 'ativo')
    .eq('tipo_operador', 'Online');

  const operators = (operatorsRaw ?? []) as Array<{
    id: string;
    name: string | null;
    external_id: string | null;
    entry_time: string;
  }>;

  const emptyResult: AdherenceMetrics = {
    escalados: 0,
    logados: 0,
    noHorario: 0,
    atrasados: 0,
    ausentes: 0,
    folgaFora: 0,
    escaladosNomes: [],
    logadosNomes: [],
    noHorarioNomes: [],
    atrasadosNomes: [],
    ausentesNomes: [],
    folgaForaNomes: [],
  };
  if (operators.length === 0) return emptyResult;

  // Qtd de chamadas atendidas hoje por colaborador (para o card "Escalados hoje") — reaproveita a
  // mesma RPC do Ranking (`get_ranking_completo`), que já sabe casar calls_raw ao operador certo
  // (operator_id/external_operator_id) e aplicar as mesmas regras de dedup/exclusão de fila.
  const chamadasPorOperador = new Map<string, number>();
  try {
    const { startIso: rankStart, endIso: rankEnd } = brasiliaDayBoundsUtc(todayStr);
    const { data: rankingHoje } = await supabase.rpc('get_ranking_completo', {
      p_from: rankStart,
      p_to: rankEnd,
      p_status_filter: 'ativo',
      p_tipo_operador_filter: 'Online',
    });
    for (const row of (Array.isArray(rankingHoje) ? rankingHoje : []) as Array<{ id: string; ligacoes: number }>) {
      chamadasPorOperador.set(row.id, Number(row.ligacoes ?? 0));
    }
  } catch {
    // Se a RPC falhar/der timeout, os cards continuam funcionando, só sem a contagem de chamadas.
  }

  const operatorIds = operators.map((operator) => operator.id);
  const { data: weeklyRows } = await supabase
    .from('operator_weekly_schedules')
    .select('operator_id, day_of_week, entry_time, active')
    .in('operator_id', operatorIds);

  const weeklyByOperator = new Map<string, Array<{ day_of_week: number; entry_time: string; active: boolean }>>();
  for (const row of weeklyRows ?? []) {
    const operatorId = row.operator_id as string;
    const list = weeklyByOperator.get(operatorId) ?? [];
    list.push({
      day_of_week: Number(row.day_of_week),
      entry_time: String(row.entry_time),
      active: row.active !== false,
    });
    weeklyByOperator.set(operatorId, list);
  }

  const { data: dateSchedulesRaw } = await supabase
    .from('operator_schedules')
    .select('operator_id, entry_time, published')
    .eq('date', todayStr)
    .in('operator_id', operatorIds);

  const dateScheduleByOperator = new Map<string, { entry_time: string; published: boolean }>();
  for (const schedule of dateSchedulesRaw ?? []) {
    dateScheduleByOperator.set(schedule.operator_id as string, {
      entry_time: String(schedule.entry_time),
      published: schedule.published !== false,
    });
  }

  const { startIso, endIso } = brasiliaDayBoundsUtc(todayStr);
  const operatorEvents = await fetchAllPages<OperatorEvent>((from, to) =>
    supabase
      .from('operator_events')
      .select('operator_id, external_operator_id, event_type, started_at, raw_payload')
      .in('event_type', ['logon', 'logoff', 'pause', 'unpause'])
      .gte('started_at', startIso)
      .lte('started_at', endIso)
      .order('started_at', { ascending: true })
      .range(from, to)
  );
  const scaleEvents = await fetchAllPages<ScaleEvent>((from, to) =>
    supabase
      .from('scale_events')
      .select('operator_id, branch, event, time_at, hour_start, raw_payload')
      .gte('time_at', startIso)
      .lte('time_at', endIso)
      .order('time_at', { ascending: true })
      .range(from, to)
  );

  const firstLogonByOperatorId = new Map<string, string>();
  const firstLogonByExternal = new Map<string, string>();
  const latestEventByOperatorId = new Map<string, OperatorEvent>();
  const latestEventByExternal = new Map<string, OperatorEvent>();
  const firstOnlineByOperatorId = new Map<string, string>();
  const firstOnlineByExternal = new Map<string, string>();
  const latestScaleByOperatorId = new Map<string, ScaleEvent>();
  const latestScaleByExternal = new Map<string, ScaleEvent>();

  for (const event of operatorEvents) {
    const operatorId = event.operator_id;
    const externalId = eventExternalId(event);
    const eventType = normalizeStatus(event.event_type);

    if (eventType === 'logon') {
      if (operatorId) {
        const current = firstLogonByOperatorId.get(operatorId);
        if (!current || compareEventWallClock(event.started_at, current) < 0) {
          firstLogonByOperatorId.set(operatorId, event.started_at);
        }
      }
      if (externalId) {
        const current = firstLogonByExternal.get(externalId);
        if (!current || compareEventWallClock(event.started_at, current) < 0) {
          firstLogonByExternal.set(externalId, event.started_at);
        }
      }
    }

    if (operatorId) {
      const current = latestEventByOperatorId.get(operatorId);
      if (!current || compareEventWallClock(event.started_at, current.started_at) > 0) {
        latestEventByOperatorId.set(operatorId, event);
      }
    }
    if (externalId) {
      const current = latestEventByExternal.get(externalId);
      if (!current || compareEventWallClock(event.started_at, current.started_at) > 0) {
        latestEventByExternal.set(externalId, event);
      }
    }
  }

  for (const event of scaleEvents) {
    const eventTime = scaleEventTime(event);
    if (!eventTime) continue;

    const operatorId = event.operator_id;
    const externalId = scaleExternalId(event);

    if (isScaleOnline(event)) {
      if (operatorId) {
        const current = firstOnlineByOperatorId.get(operatorId);
        if (!current || compareEventWallClock(eventTime, current) < 0) {
          firstOnlineByOperatorId.set(operatorId, eventTime);
        }
      }
      if (externalId) {
        const current = firstOnlineByExternal.get(externalId);
        if (!current || compareEventWallClock(eventTime, current) < 0) {
          firstOnlineByExternal.set(externalId, eventTime);
        }
      }
    }

    if (operatorId) {
      const current = latestScaleByOperatorId.get(operatorId);
      const currentTime = current ? scaleEventTime(current) : null;
      if (!currentTime || compareEventWallClock(eventTime, currentTime) > 0) {
        latestScaleByOperatorId.set(operatorId, event);
      }
    }
    if (externalId) {
      const current = latestScaleByExternal.get(externalId);
      const currentTime = current ? scaleEventTime(current) : null;
      if (!currentTime || compareEventWallClock(eventTime, currentTime) > 0) {
        latestScaleByExternal.set(externalId, event);
      }
    }
  }

  const dow = weekdayBrazil(todayStr);
  let escalados = 0;
  let logados = 0;
  let noHorario = 0;
  let atrasados = 0;
  let ausentes = 0;
  let folgaFora = 0;
  const escaladosNomes: AdherenceEmployee[] = [];
  const logadosNomes: AdherenceEmployee[] = [];
  const noHorarioNomes: AdherenceEmployee[] = [];
  const atrasadosNomes: AdherenceEmployee[] = [];
  const ausentesNomes: AdherenceEmployee[] = [];
  const folgaForaNomes: AdherenceEmployee[] = [];

  for (const operator of operators) {
    const nome = operator.name?.trim() || 'Sem nome';
    const employee: AdherenceEmployee = { id: operator.id, nome, chamadas: chamadasPorOperador.get(operator.id) ?? 0 };

    const dateSchedule = dateScheduleByOperator.get(operator.id);
    const weekly = weeklyByOperator.get(operator.id) ?? [];
    const { expediente, entrada } = dateSchedule?.published
      ? { expediente: true, entrada: String(dateSchedule.entry_time).slice(0, 5) }
      : expectedEntryForDay(operator.entry_time, weekly, dow);

    if (!expediente) {
      folgaFora += 1;
      folgaForaNomes.push(employee);
      continue;
    }

    escalados += 1;
    escaladosNomes.push(employee);
    const externalId = operator.external_id?.trim() || null;
    const logonIso =
      firstLogonByOperatorId.get(operator.id) ??
      firstOnlineByOperatorId.get(operator.id) ??
      (externalId ? firstLogonByExternal.get(externalId) ?? firstOnlineByExternal.get(externalId) ?? null : null);
    const latestEvent = latestEventByOperatorId.get(operator.id) ?? (externalId ? latestEventByExternal.get(externalId) ?? null : null);
    const latestScale = latestScaleByOperatorId.get(operator.id) ?? (externalId ? latestScaleByExternal.get(externalId) ?? null : null);

    if (
      (latestScale && !isScaleLoggedOut(latestScale)) ||
      (latestEvent && normalizeStatus(latestEvent.event_type) !== 'logoff')
    ) {
      logados += 1;
      logadosNomes.push(employee);
    }

    if (!logonIso) {
      ausentes += 1;
      ausentesNomes.push(employee);
      continue;
    }

    const expectedMin = parseTimeToMinutes(entrada ?? '08:00');
    const logonMin = minutesFromEventStoredWallClock(logonIso);
    if (logonMin <= expectedMin + GRACE_MIN) {
      noHorario += 1;
      noHorarioNomes.push(employee);
    } else {
      atrasados += 1;
      atrasadosNomes.push(employee);
    }
  }

  const byName = (a: AdherenceEmployee, b: AdherenceEmployee) => a.nome.localeCompare(b.nome, 'pt-BR');
  return {
    escalados,
    logados,
    noHorario,
    atrasados,
    ausentes,
    folgaFora,
    escaladosNomes: escaladosNomes.sort(byName),
    logadosNomes: logadosNomes.sort(byName),
    noHorarioNomes: noHorarioNomes.sort(byName),
    atrasadosNomes: atrasadosNomes.sort(byName),
    ausentesNomes: ausentesNomes.sort(byName),
    folgaForaNomes: folgaForaNomes.sort(byName),
  };
}
