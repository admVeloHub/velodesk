/**
 * especiaisChannelDetection — helpers compartilhados para exclusão do Desk Agente
 */
import { isProconChannelTicket } from './proconTicketService';
import { isConsumidorGovChannelTicket } from './consumidorGovTicketService';
import { shouldViewAllDeskTickets } from '../desk/responsavelSegmentation';

export function isEspeciaisChannelTicket(ticket) {
  return isProconChannelTicket(ticket) || isConsumidorGovChannelTicket(ticket);
}

export function isEspeciaisDeskExcludedTicket(ticket, profileId) {
  if (!ticket) return false;
  if (shouldViewAllDeskTickets(profileId)) return false;
  return isEspeciaisChannelTicket(ticket);
}
