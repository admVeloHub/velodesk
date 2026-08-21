/**
 * queueCounts v1.2.0 — contador sidebar deriva da listagem; API só sincroniza cache
 * VERSION: v1.2.0 | DATE: 2026-08-20
 */
import { boxesApi } from '../../api/client';
import { isBackendJwtUsable } from '../../utils/backendJwt';
import { isApiMode } from '../ticketsCache';
import { AGENT_DESK_QUEUE_IDS } from './constants';
import { readDeskProfileId, shouldUseMeusChamadosFila } from './responsavelSegmentation';
import deskLog from '../../utils/deskDebugLog';

const STORAGE_KEY = 'velodesk_queue_counts_v1';
const STORAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const QUEUE_COUNTS_POLL_MS = 60000;

const DESK_QUEUE_IDS = ['novos', 'em-andamento', 'pendente', 'resolvidos'];

let cachedCounts = null;
let optimisticDeltas = emptyDeltas();
let refreshInFlight = null;

function emptyDeltas() {
  return {
    novos: 0,
    'em-andamento': 0,
    pendente: 0,
    resolvidos: 0,
  };
}

function emptyCounts() {
  return {
    novos: 0,
    'em-andamento': 0,
    pendente: 0,
    resolvidos: 0,
  };
}

function normalizeCounts(raw) {
  const base = emptyCounts();
  DESK_QUEUE_IDS.forEach((id) => {
    const value = Number(raw?.[id]);
    if (Number.isFinite(value) && value >= 0) base[id] = value;
  });
  return base;
}

function dispatchCountsChanged() {
  try {
    window.dispatchEvent(new CustomEvent('velodesk:queue-counts-changed'));
  } catch {
    /* ignore */
  }
}

function persistCountsToStorage(userEmail = '') {
  if (!cachedCounts) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      savedAt: Date.now(),
      userEmail: String(userEmail || '').trim().toLowerCase(),
      counts: cachedCounts,
    }));
  } catch {
    /* quota ou modo privado */
  }
}

export function hydrateQueueCountsFromStorage(expectedEmail = '') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.counts) return false;
    if (Date.now() - Number(parsed.savedAt || 0) > STORAGE_MAX_AGE_MS) return false;
    const normalizedExpected = String(expectedEmail || '').trim().toLowerCase();
    const normalizedStored = String(parsed.userEmail || '').trim().toLowerCase();
    if (normalizedExpected && normalizedStored && normalizedExpected !== normalizedStored) return false;
    cachedCounts = normalizeCounts(parsed.counts);
    optimisticDeltas = emptyDeltas();
    return true;
  } catch {
    return false;
  }
}

export function fingerprintQueueCounts() {
  return DESK_QUEUE_IDS
    .map((id) => `${id}:${Number(cachedCounts?.[id] ?? -1)}+${Number(optimisticDeltas[id] || 0)}`)
    .join('|');
}

export function getDeskQueueDisplayCount(queueId) {
  const normalized = String(queueId || '').trim();
  if (!AGENT_DESK_QUEUE_IDS.has(normalized)) return null;
  const base = Number(cachedCounts?.[normalized]);
  const delta = Number(optimisticDeltas[normalized] || 0);
  if (!Number.isFinite(base)) return null;
  return Math.max(0, base + delta);
}

/** Delta otimista entre pollings — somado ao countByQueue (mesma base da listagem). */
export function getDeskQueueOptimisticDelta(queueId) {
  const normalized = toDeskQueueCountId(queueId);
  if (!normalized) return 0;
  return Number(optimisticDeltas[normalized] || 0);
}

function toDeskQueueCountId(queueId) {
  const id = String(queueId || '').trim();
  if (AGENT_DESK_QUEUE_IDS.has(id)) return id;
  if (id === 'meus-novos') return 'novos';
  if (id === 'em-aberto' || id === 'meus-em-aberto' || id === 'meus-em-andamento') return 'em-andamento';
  if (id === 'em-espera' || id === 'pendentes' || id === 'meus-pendente') return 'pendente';
  if (id === 'meus-resolvidos') return 'resolvidos';
  return null;
}

export function bumpDeskQueueCountOptimistic(queueId, delta = 1) {
  const normalized = toDeskQueueCountId(queueId);
  if (!normalized || !Number.isFinite(delta) || delta === 0) return;
  optimisticDeltas[normalized] = Number(optimisticDeltas[normalized] || 0) + delta;
  dispatchCountsChanged();
}

/** Entre pollings: move entre filas do Desk até a contagem real chegar. */
export function markTicketMovedOptimistic(sourceQueueId, targetQueueId) {
  const from = toDeskQueueCountId(sourceQueueId);
  const to = toDeskQueueCountId(targetQueueId);
  if (!from && !to) return;
  if (from === to) return;
  if (from) bumpDeskQueueCountOptimistic(from, -1);
  if (to) bumpDeskQueueCountOptimistic(to, 1);
}

/** Entre pollings: ticket finalizado incrementa Resolvidos até a contagem real chegar. */
export function markTicketResolvedOptimistic(sourceQueueId) {
  markTicketMovedOptimistic(sourceQueueId, 'resolvidos');
}

export async function refreshQueueCountsFromApi(userEmail = '') {
  const token = localStorage.getItem('velodesk_token');
  if (!isApiMode() || !isBackendJwtUsable(token)) {
    return cachedCounts;
  }
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    deskLog.tickets('queueCounts.refresh → início', { userEmail });
    try {
      const profileId = readDeskProfileId();
      const params = shouldUseMeusChamadosFila(profileId) ? { fila: 'meus-chamados' } : undefined;
      const data = await boxesApi.queueCounts(params);
      cachedCounts = normalizeCounts(data?.counts);
      optimisticDeltas = emptyDeltas();
      persistCountsToStorage(userEmail);
      dispatchCountsChanged();
      deskLog.tickets('queueCounts.refresh → ok', { counts: cachedCounts });
      return cachedCounts;
    } catch (err) {
      deskLog.error('TICKETS', 'queueCounts.refresh → falhou', {
        status: err?.response?.status,
        message: err?.response?.data?.message || err?.message,
      });
      throw err;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function getQueueCountsSnapshot() {
  return {
    counts: cachedCounts ? { ...cachedCounts } : null,
    optimisticDeltas: { ...optimisticDeltas },
  };
}
