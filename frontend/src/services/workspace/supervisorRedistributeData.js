/**
 * Redistribuição de tickets — supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-22
 */
import { getAllCockpitTickets, updateTicketInKanban } from '../kanbanStorage';
import { OPERATIONAL_LEADERBOARD } from './operationalLeaderboardData';

function getTicketAgentName(ticket) {
  return (ticket.responsibleAgent || ticket.lateralForm?.responsavel || '').trim();
}

function mapTicketSummary(ticket) {
  return {
    id: String(ticket.id),
    title: ticket.title || ticket.description || 'Sem assunto',
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    status: ticket.status || '—',
  };
}

export function getAgentTicketGroups() {
  const entries = getAllCockpitTickets().filter((entry) => entry.queueId !== 'resolvidos');
  const byAgent = new Map();

  entries.forEach(({ ticket }) => {
    const agent = getTicketAgentName(ticket) || 'Sem responsável';
    if (!byAgent.has(agent)) byAgent.set(agent, []);
    byAgent.get(agent).push(mapTicketSummary(ticket));
  });

  const knownNames = new Set(OPERATIONAL_LEADERBOARD.map((entry) => entry.name));
  const groups = OPERATIONAL_LEADERBOARD.map((entry) => ({
    id: entry.id,
    name: entry.name,
    tickets: byAgent.get(entry.name) || [],
  }));

  byAgent.forEach((tickets, name) => {
    if (!knownNames.has(name)) {
      groups.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        tickets,
      });
    }
  });

  return groups.filter((group) => group.tickets.length > 0);
}

export function getTargetAgentOptions(excludedNames = []) {
  const excluded = new Set(excludedNames);
  return OPERATIONAL_LEADERBOARD.filter((entry) => !excluded.has(entry.name)).map((entry) => ({
    id: entry.id,
    name: entry.name,
  }));
}

export function collectTicketsFromAgents(groups, selectedAgentNames) {
  const selected = new Set(selectedAgentNames);
  return groups
    .filter((group) => selected.has(group.name))
    .flatMap((group) => group.tickets);
}

export async function redistributeTickets(ticketIds, targetAgentName) {
  const uniqueIds = [...new Set(ticketIds.map(String))];
  const now = new Date().toISOString();

  for (const ticketId of uniqueIds) {
    await updateTicketInKanban(ticketId, (ticket) => {
      ticket.responsibleAgent = targetAgentName;
      ticket.lateralForm = {
        ...(ticket.lateralForm || {}),
        responsavel: targetAgentName,
      };
      ticket.updatedAt = now;
      return ticket;
    });
  }

  return uniqueIds.length;
}
