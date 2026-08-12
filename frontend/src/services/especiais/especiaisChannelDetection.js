/**
 * especiaisChannelDetection — helpers compartilhados para exclusão do Desk Agente
 * VERSION: v1.1.0 | DATE: 2026-08-12
 * — Inclui Reclame Aqui junto com Procon e Consumidor.Gov
 */
import { isProconChannelTicket } from './proconTicketService';
import { isConsumidorGovChannelTicket } from './consumidorGovTicketService';
import { isReclameAquiChannelTicket } from './reclameAquiTicketService';
import { shouldViewAllDeskTickets } from '../desk/responsavelSegmentation';

export function isEspeciaisChannelTicket(ticket) {
  return isProconChannelTicket(ticket)
    || isConsumidorGovChannelTicket(ticket)
    || isReclameAquiChannelTicket(ticket);
}

export function isEspeciaisDeskExcludedTicket(ticket, profileId) {
  if (!ticket) return false;
  if (shouldViewAllDeskTickets(profileId)) return false;
  return isEspeciaisChannelTicket(ticket);
}
