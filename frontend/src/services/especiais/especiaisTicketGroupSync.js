/**
 * especiaisTicketGroupSync — atualiza fila Finalizadas quando ticket Desk muda de status
 */
import { updateReclamacaoGroupFromTicket } from './reclameAquiStore';
import { updateDemandaGroupFromTicket as updateProconGroupFromTicket } from './proconStore';
import { updateDemandaGroupFromTicket as updateConsumidorGovGroupFromTicket } from './consumidorGovStore';
import { updateDemandaGroupFromTicket as updateBacenGroupFromTicket } from './bacenStore';
import { isReclameAquiChannelTicket } from './especiaisChannelDetection';
import { isProconChannelTicket } from './proconTicketService';
import { isConsumidorGovChannelTicket } from './consumidorGovTicketService';
import { isBacenChannelTicket } from './bacenTicketService';

const SYNC_EVENTS = {
  ra: 'velodesk:ra-sync',
  procon: 'velodesk:procon-sync',
  gov: 'velodesk:consumidor-gov-sync',
  bacen: 'velodesk:bacen-sync',
};

function dispatchSync(eventName) {
  if (typeof window === 'undefined' || !eventName) return;
  window.dispatchEvent(new CustomEvent(eventName));
}

/** Recalcula groupKey da demanda do canal especial conforme status do ticket. */
export function syncEspeciaisGroupFromTicket(ticket) {
  if (!ticket) return null;

  if (isReclameAquiChannelTicket(ticket)) {
    const updated = updateReclamacaoGroupFromTicket(ticket);
    if (updated) dispatchSync(SYNC_EVENTS.ra);
    return updated;
  }
  if (isProconChannelTicket(ticket)) {
    const updated = updateProconGroupFromTicket(ticket);
    if (updated) dispatchSync(SYNC_EVENTS.procon);
    return updated;
  }
  if (isConsumidorGovChannelTicket(ticket)) {
    const updated = updateConsumidorGovGroupFromTicket(ticket);
    if (updated) dispatchSync(SYNC_EVENTS.gov);
    return updated;
  }
  if (isBacenChannelTicket(ticket)) {
    const updated = updateBacenGroupFromTicket(ticket);
    if (updated) dispatchSync(SYNC_EVENTS.bacen);
    return updated;
  }

  return null;
}
