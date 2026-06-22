/**
 * Escalonamento de tickets — supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-22
 */
import { updateTicketInKanban } from '../kanbanStorage';
import { ESCALONAR_OPTIONS } from '../desk/constants';
import { formatCpf, normalizeCpf, resolveDeskSearchEntries } from '../desk/utils';

export { ESCALONAR_OPTIONS };

export function searchTicketsForEscalation(query) {
  return resolveDeskSearchEntries(query, 'data')
    .filter((entry) => entry.queueId !== 'resolvidos')
    .map(mapTicketSearchResult);
}

function mapTicketSearchResult({ ticket, queueId }) {
  const cpfDigits = normalizeCpf(ticket.lateralForm?.cpf || ticket.clientCPF || '');
  return {
    id: String(ticket.id),
    title: ticket.title || ticket.description || 'Sem assunto',
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    cpf: cpfDigits ? formatCpf(cpfDigits) : '—',
    queueId,
    responsibleAgent: ticket.responsibleAgent || ticket.lateralForm?.responsavel || '—',
    currentEscalonar: ticket.lateralForm?.escalonar || null,
  };
}

export async function escalateTicket(ticketId, escalonarId) {
  const now = new Date().toISOString();
  return updateTicketInKanban(ticketId, (ticket) => {
    const prevLf = ticket.lateralForm || {};
    ticket.lateralForm = {
      ...prevLf,
      escalonar: escalonarId,
      wasEscalated: true,
      lastWorkflow: escalonarId,
      retornoN1: false,
    };
    ticket.updatedAt = now;
    return ticket;
  });
}
