/**
 * Redistribuição de tickets — supervisor
 * VERSION: v2.2.0 | DATE: 2026-07-06
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit, cockpitTicketToApi } from '../../api/adapters/ticketAdapter';
import { findTicketEntry, getAllCockpitTickets, updateTicketInKanban } from '../kanbanStorage';
import { loadKanbanFromApi } from '../ticketsCache';
import { fetchWorkspace360Agents } from './workspace360Api';

let cachedAgents = null;

async function loadAgents() {
  if (cachedAgents) return cachedAgents;
  try {
    cachedAgents = await fetchWorkspace360Agents();
  } catch {
    cachedAgents = [];
  }
  return cachedAgents;
}

function getTicketAgentName(ticket) {
  return (ticket.responsibleAgent || ticket.lateralForm?.responsavel || '').trim();
}

function mapTicketSummary(ticket) {
  return {
    id: String(ticket.id || ticket._id),
    title: ticket.title || ticket.description || ticket.chamadoTitulo || 'Sem assunto',
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    status: ticket.status || '—',
  };
}

function normalizeSearchQuery(raw) {
  return String(raw ?? '').trim().replace(/^#/, '');
}

function mapTicketDetail(ticket) {
  const normalized = apiTicketToCockpit(ticket);
  return {
    id: String(normalized._id || normalized.id),
    protocol: normalized.chamadoProtocolo || '',
    title: normalized.title || normalized.chamadoTitulo || 'Sem assunto',
    clientName: normalized.clientName || normalized.solicitante || 'Cliente',
    status: normalized.status || '—',
    currentAgent: getTicketAgentName(normalized) || 'Sem responsável',
    ticket: normalized,
  };
}

function matchesTicketQuery(ticket, query) {
  const id = String(ticket.id || ticket._id || '');
  const protocol = String(ticket.chamadoProtocolo || '').trim();
  const lowerQuery = query.toLowerCase();

  if (id === query || protocol === query) return true;
  if (protocol && protocol.toLowerCase().includes(lowerQuery)) return true;
  if (/^\d+$/.test(query) && (id.endsWith(query) || protocol.endsWith(query))) return true;
  return false;
}

function currentStatusAllowsRedistribute(ticket) {
  const status = String(ticket.status || '').toLowerCase();
  return status !== 'resolvido' && status !== 'resolvidos';
}

export async function getAgentTicketGroups() {
  const agents = await loadAgents();
  const entries = getAllCockpitTickets().filter((entry) => entry.queueId !== 'resolvidos');
  const byAgent = new Map();

  entries.forEach(({ ticket }) => {
    const agent = getTicketAgentName(ticket) || 'Sem responsável';
    if (!byAgent.has(agent)) byAgent.set(agent, []);
    byAgent.get(agent).push(mapTicketSummary(ticket));
  });

  const knownNames = new Set(agents.map((entry) => entry.name));
  const groups = agents.map((entry) => ({
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

export async function getTargetAgentOptions(excludedNames = []) {
  const agents = await loadAgents();
  const excluded = new Set(excludedNames);
  return agents
    .filter((entry) => !excluded.has(entry.name))
    .map((entry) => ({ id: entry.id, name: entry.name }));
}

export async function getAgentOptions(excludedName = '') {
  return getTargetAgentOptions(excludedName ? [excludedName] : []);
}

export function collectTicketsFromAgents(groups, selectedAgentNames) {
  const selected = new Set(selectedAgentNames);
  return groups
    .filter((group) => selected.has(group.name))
    .flatMap((group) => group.tickets);
}

export async function searchTicketByNumber(rawQuery) {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return null;

  const entries = getAllCockpitTickets().filter((entry) => entry.queueId !== 'resolvidos');
  const localMatch = entries.find(({ ticket }) => matchesTicketQuery(ticket, query));
  if (localMatch) return mapTicketDetail(localMatch.ticket);

  try {
    const byProtocol = await ticketsApi.getByProtocol(query);
    if (byProtocol && currentStatusAllowsRedistribute(byProtocol)) {
      return mapTicketDetail(byProtocol);
    }
  } catch {
    // segue para próxima estratégia
  }

  if (/^[a-f0-9]{24}$/i.test(query)) {
    try {
      const byId = await ticketsApi.get(query);
      if (byId && currentStatusAllowsRedistribute(byId)) {
        return mapTicketDetail(byId);
      }
    } catch {
      return null;
    }
  }

  return null;
}

async function persistResponsavelUpdate(ticketId, ticketSnapshot, targetAgentName) {
  const payload = {
    ...ticketSnapshot,
    responsibleAgent: targetAgentName,
    lateralForm: {
      ...(ticketSnapshot.lateralForm || {}),
      responsavel: targetAgentName,
    },
  };

  const cached = findTicketEntry(ticketId);
  if (cached) {
    await updateTicketInKanban(ticketId, (ticket) => {
      ticket.responsibleAgent = targetAgentName;
      ticket.lateralForm = {
        ...(ticket.lateralForm || {}),
        responsavel: targetAgentName,
      };
      ticket.updatedAt = new Date().toISOString();
      return ticket;
    });
    return;
  }

  await ticketsApi.update(ticketId, cockpitTicketToApi(payload));
  await loadKanbanFromApi();
}

export async function redistributeTicket(ticketId, targetAgentName, ticketSnapshot = null) {
  const id = String(ticketId);
  const snapshot = ticketSnapshot || findTicketEntry(id)?.ticket;
  if (!snapshot) {
    throw new Error('Ticket não encontrado para redistribuição.');
  }

  await persistResponsavelUpdate(id, snapshot, targetAgentName);
  return {
    count: 1,
    ticketId: id,
    targetAgent: targetAgentName,
    previousAgent: getTicketAgentName(snapshot) || 'Sem responsável',
  };
}

export async function redistributeTickets(ticketIds, targetAgentName) {
  const uniqueIds = [...new Set(ticketIds.map(String))];

  for (const ticketId of uniqueIds) {
    await redistributeTicket(ticketId, targetAgentName);
  }

  return uniqueIds.length;
}

export function clearAgentCache() {
  cachedAgents = null;
}
