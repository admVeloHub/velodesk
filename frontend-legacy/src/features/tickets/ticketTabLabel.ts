/** ticketTabLabel v1.0.0 — rótulo das abas de chamados abertos */
import { Ticket } from '../../types';

export function getTicketTabLabel(ticket: Ticket): string {
  return ticket.chamadoProtocolo?.trim() || ticket.title;
}
