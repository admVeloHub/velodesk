/**
 * Workspace — dados operacionais do painel 360°
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import { getAllCockpitTickets } from '../kanbanStorage';
import { getAgentName } from '../clientDb';
import { getSlaClass } from '../desk/utils';

export function computeAgentDeskData() {
  const entries = getAllCockpitTickets();
  const agent = getAgentName();
  const counts = { novos: 0, emAndamento: 0, pendente: 0, resolvidos: 0, slaCritico: 0, aguardandoRetorno: 0 };

  const enriched = entries
    .filter((e) => e.queueId !== 'resolvidos')
    .map(({ ticket, queueId }) => {
      if (queueId === 'novos') counts.novos++;
      if (queueId === 'em-andamento') counts.emAndamento++;
      if (queueId === 'pendente') counts.pendente++;
      if (queueId === 'resolvidos') counts.resolvidos++;
      if (getSlaClass(ticket) === 'critical') counts.slaCritico++;
      if (queueId === 'pendente') counts.aguardandoRetorno++;
      return { ticket, queueId, sla: getSlaClass(ticket) };
    })
    .sort((a, b) => {
      const prio = { critical: 0, warning: 1, ok: 2 };
      return (prio[a.sla] || 9) - (prio[b.sla] || 9);
    });

  const nextAction = enriched[0] || null;

  return {
    agentName: agent,
    counts,
    enriched,
    nextAction,
    personal: { sla: 98, tma: '4m 12s', csat: '4.6' },
    hotClients: enriched.filter((e) => getSlaClass(e.ticket) !== 'ok').slice(0, 5)
  };
}

export function computeSupervisorData() {
  const entries = getAllCockpitTickets();
  const online = 12;
  const slaRisk = entries.filter((e) => getSlaClass(e.ticket) === 'critical').length;
  return {
    online,
    slaRisk,
    slaPct: 87,
    nps: 4.2,
    volume: entries.length,
    warRoom: slaRisk >= 3
  };
}

export function computeManagementStats() {
  const entries = getAllCockpitTickets();
  const resolved = entries.filter((e) => e.queueId === 'resolvidos').length;
  return {
    volume: entries.length + 1200,
    tma: '4m 32s',
    fcr: '76%',
    forecast: '+18%',
    resolved
  };
}
