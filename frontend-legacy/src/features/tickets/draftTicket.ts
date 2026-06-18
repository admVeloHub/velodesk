/** draftTicket v1.0.0 — rascunho local até Salvar/status */
import { Ticket } from '../../types';

export function generateProtocolo(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `VD-${stamp}-${suffix}`;
}

export function isDraftTicket(ticket: Pick<Ticket, '_id' | 'isDraft'>): boolean {
  return ticket.isDraft === true || ticket._id.startsWith('draft-');
}

export function createDraftTicket(): Ticket {
  const protocolo = generateProtocolo();
  return {
    _id: `draft-${crypto.randomUUID()}`,
    chamadoProtocolo: protocolo,
    chamadoTitulo: '',
    title: protocolo,
    status: '',
    priority: 'media',
    channel: 'digital',
    source: 'velodesk',
    isDraft: true,
    lateralForm: {},
    messages: [],
    internalNotes: [],
  };
}
