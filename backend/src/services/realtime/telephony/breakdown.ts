import { queueDisplayName, isLeticiaOperatorPhone, isRedirectQueueName, onlyDigits } from './queueDisplay';

export type CallRawFullRow = {
  call_id: string | null;
  chamada: string | null;
  status?: string | null;
  wait_time_sec: number | null;
  talk_time_sec: number | null;
  humor_cliente?: string | number | null;
  qualidade_ligacao?: string | number | null;
  raw_payload: Record<string, unknown> | null;
  queue_name: string | null;
  wx_queue_id?: string | null;
  queue_id?: string | null;
  operador?: string | null;
  customer_number?: string | null;
  numero?: string | null;
  ddd?: string | null;
  pais?: number | null;
  started_at?: string | null;
  data_atendimento?: string | null;
  tempo_ura_sec?: number | null;
  external_operator_id?: string | null;
  operator_id?: string | null;
};

export type QueueBreakdownRow = {
  label: string;
  total: number;
  atendidas: number;
  abandonadas: number;
  tmaSec: number | null;
  maxWaitSec: number | null;
  maxTalkSec: number | null;
  sla30?: number;
  wait_sum?: number;
  talk_sum?: number;
};

export const LETICIA_BUCKET_LABEL = 'Letícia IA';
export const SEM_FILA_BUCKET_LABEL = 'Retida na URA';
export const OUTRAS_BUCKET_LABEL = 'Outras';

const LETICIA_PAIRING_WINDOW_MS = 5000;
const TOP_QUEUE_BUCKETS = 4;

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isCallAttended(call: Pick<CallRawFullRow, 'chamada' | 'status'>): boolean {
  const status = normalizeStatus(`${call.chamada ?? ''} ${call.status ?? ''}`);
  return (
    status.includes('call_attended') ||
    status.includes('atendida') ||
    status.includes('attended') ||
    status.includes('answered') ||
    status.includes('completed') ||
    status.includes('connected')
  );
}

export function isAbandoned(chamada: string | null | undefined): boolean {
  return ['call_abandoned', 'abandonada', 'abandoned'].includes(String(chamada ?? '').trim().toLowerCase());
}

/** Mesmo critério de "retida na URA" usado no Realtime e na RPC get_dashboard_kpis (migration 116). */
export function isRetainedUra(chamada: string | null | undefined): boolean {
  const status = normalizeStatus(chamada);
  return status === 'call_retained_ura' || status.includes('retain') || status.includes('retid');
}

function callPhoneKey(call: Pick<CallRawFullRow, 'customer_number' | 'numero' | 'ddd' | 'pais'>): string {
  const direct = onlyDigits(call.customer_number);
  if (direct) return direct;
  return onlyDigits(`${call.pais ?? ''}${call.ddd ?? ''}${call.numero ?? ''}`);
}

export function isLeticiaLeg(
  call: Pick<CallRawFullRow, 'chamada' | 'status' | 'queue_name' | 'operador'>,
): boolean {
  return isCallAttended(call) && isRedirectQueueName(call.queue_name) && isLeticiaOperatorPhone(call.operador);
}

export function bucketLabelFor(call: CallRawFullRow, isLeticia: boolean): string {
  if (isLeticia) return LETICIA_BUCKET_LABEL;
  if (isRetainedUra(call.chamada) && !String(call.queue_name ?? '').trim()) return SEM_FILA_BUCKET_LABEL;
  return queueDisplayName(call.queue_name, call.wx_queue_id);
}

export function aggregateCallRows(rows: CallRawFullRow[]): Omit<QueueBreakdownRow, 'label'> {
  const attended = rows.filter(isCallAttended);
  const abandoned = rows.filter((row) => isAbandoned(row.chamada));
  const talkTimes = attended.map((row) => Number(row.talk_time_sec)).filter(Number.isFinite);
  const waitTimes = attended.map((row) => Number(row.wait_time_sec)).filter(Number.isFinite);
  const sla30 = attended.filter((row) => Number(row.wait_time_sec ?? 999) <= 30).length;

  return {
    total: rows.length,
    atendidas: attended.length,
    abandonadas: abandoned.length,
    tmaSec: talkTimes.length ? Math.round(talkTimes.reduce((a, b) => a + b, 0) / talkTimes.length) : null,
    maxWaitSec: waitTimes.length ? Math.max(...waitTimes) : null,
    maxTalkSec: talkTimes.length ? Math.max(...talkTimes) : null,
    sla30,
    wait_sum: attended.reduce((sum, row) => sum + Number(row.wait_time_sec ?? 0), 0),
    talk_sum: attended.reduce((sum, row) => sum + Number(row.talk_time_sec ?? 0), 0),
  };
}

/** Índices das pernas Retida-na-URA pareadas com Letícia (mesma ligação, 2 linhas no 55PBX). */
export function getPairedUraExcludedIndices(calls: CallRawFullRow[]): Set<number> {
  const withIndex = calls.map((call, index) => ({ call, index }));
  const byCallId = new Map<string, { call: CallRawFullRow; index: number }>();
  const byPhone = new Map<string, { call: CallRawFullRow; index: number }[]>();

  for (const item of withIndex) {
    if (item.call.call_id) byCallId.set(item.call.call_id, item);
    const key = callPhoneKey(item.call);
    if (!key) continue;
    const list = byPhone.get(key) ?? [];
    list.push(item);
    byPhone.set(key, list);
  }

  const excluded = new Set<number>();

  for (const item of withIndex) {
    if (!isLeticiaLeg(item.call)) continue;

    const originCallId = String(item.call.raw_payload?.call_id_origin ?? '').trim();
    const originCandidate = originCallId ? byCallId.get(originCallId) : undefined;
    if (originCandidate && !excluded.has(originCandidate.index) && isRetainedUra(originCandidate.call.chamada)) {
      excluded.add(originCandidate.index);
      continue;
    }

    const phoneKey = callPhoneKey(item.call);
    if (!phoneKey) continue;
    const leticiaTime = item.call.started_at ? new Date(item.call.started_at).getTime() : NaN;
    if (!Number.isFinite(leticiaTime)) continue;

    let best: { index: number; diff: number } | null = null;
    for (const candidate of byPhone.get(phoneKey) ?? []) {
      if (candidate.index === item.index || excluded.has(candidate.index)) continue;
      if (!isRetainedUra(candidate.call.chamada)) continue;
      const candidateTime = candidate.call.started_at ? new Date(candidate.call.started_at).getTime() : NaN;
      if (!Number.isFinite(candidateTime)) continue;
      const diff = leticiaTime - candidateTime;
      if (diff < 0 || diff > LETICIA_PAIRING_WINDOW_MS) continue;
      if (!best || diff < best.diff) best = { index: candidate.index, diff };
    }

    if (best) excluded.add(best.index);
  }

  return excluded;
}

function bucketCalls(
  calls: CallRawFullRow[],
  topN: number | null,
): {
  retidasUra: number;
  leticia: number;
  porFila: QueueBreakdownRow[];
  excluded: Set<number>;
} {
  const excluded = getPairedUraExcludedIndices(calls);
  const consideredCalls = calls.filter((_, index) => !excluded.has(index));

  const bucketed = new Map<string, CallRawFullRow[]>();
  let leticiaCount = 0;
  let retidasUraCount = 0;

  for (const call of consideredCalls) {
    const leticia = isLeticiaLeg(call);
    if (leticia) leticiaCount += 1;
    if (isRetainedUra(call.chamada)) retidasUraCount += 1;

    const label = bucketLabelFor(call, leticia);
    const list = bucketed.get(label) ?? [];
    list.push(call);
    bucketed.set(label, list);
  }

  const bucketEntries = [...bucketed.entries()].sort((a, b) => b[1].length - a[1].length);

  let porFila: QueueBreakdownRow[];
  if (topN == null) {
    porFila = bucketEntries.map(([label, rows]) => ({ label, ...aggregateCallRows(rows) }));
  } else {
    const top = bucketEntries.slice(0, topN);
    const rest = bucketEntries.slice(topN);
    porFila = top.map(([label, rows]) => ({ label, ...aggregateCallRows(rows) }));
    if (rest.length > 0) {
      const restRows = rest.flatMap(([, rows]) => rows);
      porFila.push({ label: OUTRAS_BUCKET_LABEL, ...aggregateCallRows(restRows) });
    }
  }

  return { retidasUra: retidasUraCount, leticia: leticiaCount, porFila, excluded };
}

/** Top N filas + "Outras" — usado no Realtime. */
export function computeTelephonyBreakdown(calls: CallRawFullRow[]): {
  retidasUra: number;
  leticia: number;
  porFila: QueueBreakdownRow[];
} {
  const { retidasUra, leticia, porFila } = bucketCalls(calls, TOP_QUEUE_BUCKETS);
  return { retidasUra, leticia, porFila };
}

/** Total de chamadas + segundos falados hoje pela Letícia IA — independente do top-N de filas. */
export function computeLeticiaTalkSummary(calls: CallRawFullRow[]): { count: number; talkSec: number } {
  const excluded = getPairedUraExcludedIndices(calls);
  let count = 0;
  let talkSec = 0;
  calls.forEach((call, index) => {
    if (excluded.has(index) || !isLeticiaLeg(call)) return;
    count += 1;
    talkSec += Number(call.talk_time_sec ?? 0) || 0;
  });
  return { count, talkSec };
}

/** Todas as filas/buckets — usado no Dashboard histórico. */
export function computeTelephonyBreakdownAllQueues(calls: CallRawFullRow[]): {
  retidasUra: number;
  leticia: number;
  porFila: QueueBreakdownRow[];
  pairedExcludedCount: number;
} {
  const excluded = getPairedUraExcludedIndices(calls);
  const { retidasUra, leticia, porFila } = bucketCalls(calls, null);
  return { retidasUra, leticia, porFila, pairedExcludedCount: excluded.size };
}
