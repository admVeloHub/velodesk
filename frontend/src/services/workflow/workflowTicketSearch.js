/**
 * workflowTicketSearch — busca por CPF ou ticket (painel Workflow 360°)
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import { getAllCockpitTickets } from '../ticketsStorage';
import { getTicketProtocolLabel, isTicketInWorkflow, normalizeCpf } from '../desk/utils';
import { ticketMatchesWorkflowTeam } from './workflowTeamQueues';

function normalizeQuery(rawQuery) {
  return String(rawQuery ?? '').trim().replace(/^#/, '');
}

function ticketId(ticket) {
  return String(ticket?.id || ticket?._id || '').trim();
}

function matchesTicketQuery(ticket, query) {
  const lowerQuery = query.toLowerCase();
  const id = ticketId(ticket);
  const protocol = String(ticket?.chamadoProtocolo || '').trim();

  if (id === query || protocol === query) return true;
  if (protocol && protocol.toLowerCase().includes(lowerQuery)) return true;
  if (/^\d+$/.test(query) && (id.includes(query) || protocol.includes(query))) return true;
  if (id.toLowerCase().includes(lowerQuery)) return true;

  const hay = [
    id,
    protocol,
    ticket?.title,
    ticket?.chamadoTitulo,
    ticket?.clientName,
    ticket?.solicitante,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(lowerQuery);
}

function mapSearchResult(entry) {
  const { ticket } = entry;
  return {
    id: ticketId(ticket),
    protocol: getTicketProtocolLabel(ticket) || ticket?.chamadoProtocolo || ticketId(ticket),
    title: ticket?.title || ticket?.chamadoTitulo || ticket?.description || 'Sem assunto',
    clientName: ticket?.clientName || ticket?.solicitante || 'Cliente',
    ticket,
  };
}

function searchLocalTickets(query) {
  const digits = normalizeCpf(query);
  const all = getAllCockpitTickets();

  if (digits.length === 11) {
    return all
      .filter(({ ticket }) => {
        const cpf = normalizeCpf(ticket?.lateralForm?.cpf || ticket?.clientCPF || '');
        return cpf === digits;
      })
      .map(mapSearchResult);
  }

  return all
    .filter(({ ticket }) => matchesTicketQuery(ticket, query))
    .map(mapSearchResult);
}

function dedupeResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function searchTicketsByQuery(rawQuery) {
  const query = normalizeQuery(rawQuery);
  if (!query) return [];

  const local = dedupeResults(searchLocalTickets(query));
  if (local.length) return local;

  try {
    const byProtocol = await ticketsApi.getByProtocol(query);
    if (byProtocol) {
      const ticket = apiTicketToCockpit(byProtocol);
      return [mapSearchResult({ ticket, queueId: '' })];
    }
  } catch {
    // tenta por id abaixo
  }

  if (/^[a-f0-9]{24}$/i.test(query)) {
    try {
      const byId = await ticketsApi.get(query);
      if (byId) {
        const ticket = apiTicketToCockpit(byId);
        return [mapSearchResult({ ticket, queueId: '' })];
      }
    } catch {
      return [];
    }
  }

  return [];
}

export function resolveOpenTarget(ticket, teamQueueId) {
  if (!isTicketInWorkflow(ticket)) return 'desk';
  if (!teamQueueId) return 'workflow';
  if (ticketMatchesWorkflowTeam(ticket, teamQueueId)) return 'workflow';
  return 'desk';
}
