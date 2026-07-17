/**

 * useProdSolicTicketPrefill — pré-preenche CPF/Ticket do ticket aberto

 */

import { useCallback, useEffect, useState } from 'react';

import { useTickets } from '../../../context/TicketsContext';

import { findTicketEntry } from '../../../services/kanbanStorage';

import { formatCpf, getClientContactFields, getTicketProtocolLabel } from '../../../services/desk/utils';



function buildPrefillFromTicket(ticket, client) {

  if (!ticket) return { cpf: '', ticketId: '', produto: '' };

  const contact = getClientContactFields(ticket, client);

  const protocol = getTicketProtocolLabel(ticket);

  return {

    cpf: contact.cpf || '',

    ticketId: protocol || String(ticket.id || ''),

    produto: ticket?.lateralForm?.produto || '',

  };

}



export function useProdSolicTicketPrefill({ ticketOverride, clientOverride } = {}) {

  const { activeTabId } = useTickets();

  const [prefill, setPrefill] = useState({ cpf: '', ticketId: '', produto: '' });



  const resolvePrefill = useCallback(() => {

    if (ticketOverride) {

      return buildPrefillFromTicket(ticketOverride, clientOverride);

    }

    if (!activeTabId) return { cpf: '', ticketId: '', produto: '' };

    const entry = findTicketEntry(activeTabId);

    if (!entry?.ticket) return { cpf: '', ticketId: '', produto: '' };

    return buildPrefillFromTicket(entry.ticket, clientOverride);

  }, [activeTabId, ticketOverride, clientOverride]);



  useEffect(() => {

    setPrefill(resolvePrefill());

  }, [resolvePrefill]);



  return { prefill, activeTabId, formatCpf };

}



export function validateCpfTicket(form, showNotification) {

  const cpfDigits = String(form.cpf || '').replace(/\D/g, '');

  const ticketId = String(form.ticketId || '').trim();



  if (cpfDigits.length !== 11) {

    showNotification('Informe um CPF válido com 11 dígitos.', 'error');

    return false;

  }

  if (!ticketId) {

    showNotification('Informe o ticket.', 'error');

    return false;

  }

  return true;

}


