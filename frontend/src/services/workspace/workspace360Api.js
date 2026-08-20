/**
 * workspace360Api v1.1.1 — fingerprint aceita kpis objeto (payload agente)
 * VERSION: v1.1.1 | DATE: 2026-08-20
 */
import api from '../../api/client';

/** Intervalo do poll invisível no Painel 360° (alinhado ao refresh leve do Desk). */
export const WORKSPACE360_POLL_MS = 15000;

export async function fetchWorkspace360(params) {
  const { data } = await api.get('/workspace360', { params });
  return data;
}

function kpiFingerprint(kpis) {
  if (!kpis) return '';
  if (Array.isArray(kpis)) {
    return kpis.map((k) => `${k?.id}:${k?.value}`).join('|');
  }
  return Object.keys(kpis)
    .sort()
    .map((key) => `${key}:${kpis[key]}`)
    .join('|');
}

function sectionTicketIds(section) {
  const rows = section?.entries ?? section?.tickets ?? [];
  return rows
    .map((entry) => {
      const t = entry?.ticket ?? entry;
      return String(t?.id ?? t?._id ?? '').trim();
    })
    .filter(Boolean)
    .join(',');
}

/** Assinatura estável para evitar re-render quando o payload não mudou. */
export function fingerprintWorkspace360Payload(payload) {
  if (!payload) return '';
  const sections = (payload.sections ?? []).map((section) => ({
    id: section.id,
    count: section.count ?? 0,
    tickets: sectionTicketIds(section),
  }));
  return JSON.stringify({
    alert: payload.alert?.ticketId ?? null,
    kpis: kpiFingerprint(payload.kpis),
    sections,
    productionWeek: (payload.productionWeek ?? []).map((d) => d.value).join(','),
    escalated: payload.escalated?.slaCriticalCount ?? null,
    leaderboard: (payload.leaderboard?.ranking ?? []).length,
  });
}

export async function fetchWorkspace360Report(reportId, filters = {}) {
  const { data } = await api.get('/workspace360', {
    params: { report: reportId, ...filters },
  });
  return data.report;
}

export async function fetchWorkspace360Agents() {
  const { data } = await api.get('/workspace360/agents');
  return data;
}

/** Leaderboard operacional com período próprio (Hoje/Ontem/Mês/Personalizado), independente do resto do painel. */
export async function fetchWorkspace360Leaderboard({ period, from, to } = {}) {
  const { data } = await api.get('/workspace360', {
    params: {
      profile: 'gestao',
      leaderboardPeriod: period,
      leaderboardFrom: from,
      leaderboardTo: to,
    },
  });
  return data?.leaderboard ?? { ranking: [] };
}

/** Tickets "em andamento" de um colaborador (drill-down do leaderboard), do mais antigo pro mais novo. */
export async function fetchAgentInProgressTickets({ agentKey } = {}) {
  const { data } = await api.get('/workspace360/agent-tickets', {
    params: { agentKey },
  });
  return data?.tickets ?? [];
}
