/**
 * especiaisChannelDetection — helpers compartilhados para exclusão do Desk Agente
 * VERSION: v1.2.0 | DATE: 2026-08-21
 * — CE nunca entra no módulo Tickets (exclusão absoluta; ver_todos não libera)
 */
import { isProconChannelTicket } from './proconTicketService';
import { isConsumidorGovChannelTicket } from './consumidorGovTicketService';
import { isReclameAquiChannelTicket } from './reclameAquiTicketService';
import { isBacenChannelTicket } from './bacenTicketService';

export function isEspeciaisChannelTicket(ticket) {
  return isProconChannelTicket(ticket)
    || isConsumidorGovChannelTicket(ticket)
    || isReclameAquiChannelTicket(ticket)
    || isBacenChannelTicket(ticket);
}

/** Exclusão absoluta do módulo Tickets — independente de ver_todos / profileId. */
export function isEspeciaisDeskExcludedTicket(ticket, _profileId) {
  if (!ticket) return false;
  return isEspeciaisChannelTicket(ticket);
}

export { isReclameAquiChannelTicket };
