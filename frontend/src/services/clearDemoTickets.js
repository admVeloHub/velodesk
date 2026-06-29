/**
 * Limpa tickets demo do cache e flags de seed local
 * VERSION: v1.1.0 | DATE: 2026-06-24
 */
import { setCachedColumns } from './ticketsCache';

const EMPTY_COLUMNS = [
  { id: 'novos', name: 'Novos', tickets: [] },
  { id: 'em-andamento', name: 'Em Andamento', tickets: [] },
  { id: 'em-espera', name: 'Pendente', tickets: [] },
  { id: 'pendentes', name: 'Aguardando retorno', tickets: [] },
  { id: 'resolvidos', name: 'Resolvidos', tickets: [] },
];

const DEMO_FLAGS = [
  'velodeskDemoTickets3',
  'velodeskDeskV2Seeded',
  'velodeskEcosystemSeeded',
  'velodeskClient360',
  'velodeskClientDB',
];

function isDemoTicket(ticket) {
  return Boolean(ticket?.isDemo || ticket?.isQueueTest || ticket?.isLocalTest);
}

export function clearDemoTickets() {
  setCachedColumns(EMPTY_COLUMNS.map((box) => ({ ...box, tickets: [] })));
  if (typeof localStorage === 'undefined') return;
  DEMO_FLAGS.forEach((key) => localStorage.removeItem(key));
}

export function stripDemoTicketsFromColumns(columns) {
  if (!Array.isArray(columns)) return columns;
  return columns.map((box) => ({
    ...box,
    tickets: (box.tickets || []).filter((t) => !isDemoTicket(t)),
  }));
}
