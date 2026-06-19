/**
 * Kanban / tickets — facade API + cache local (fallback demo)
 * VERSION: v1.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import {
  getCachedColumns,
  setCachedColumns,
  loadKanbanFromApi,
  updateTicketViaApi,
  addMessageViaApi,
  createTicketViaApi,
  isApiMode,
} from './ticketsCache';
import { apiTicketToCockpit } from '../api/adapters/ticketAdapter';

export async function refreshKanbanFromApi() {
  return loadKanbanFromApi();
}

export function getKanbanColumns() {
  return getCachedColumns();
}

export function saveKanbanColumns(nextColumns) {
  setCachedColumns(nextColumns);
}

export function findTicketEntry(ticketId) {
  const id = String(ticketId);
  const cols = getKanbanColumns();
  for (let i = 0; i < cols.length; i++) {
    const box = cols[i];
    const t = (box.tickets || []).find((x) => String(x.id) === id || String(x._id) === id);
    if (t) return { ticket: t, boxId: box.id, box, queueId: mapTicketQueueId(t, box.id) };
  }
  return null;
}

export function getAllCockpitTickets() {
  const cols = getKanbanColumns();
  const list = [];
  cols.forEach((box) => {
    (box.tickets || []).forEach((t) => {
      list.push({ ticket: t, boxId: box.id, queueId: mapTicketQueueId(t, box.id) });
    });
  });
  return list;
}

const QUEUE_MAP = {
  novos: ['novos', 'novo'],
  'em-andamento': ['em-andamento', 'em-aberto'],
  pendente: ['em-espera', 'pendentes', 'pendente'],
  resolvidos: ['resolvidos', 'resolvido'],
};

import { loadCustomQueues } from './desk/customQueueBoxes';

export function mapTicketQueueId(ticket, boxId) {
  const custom = loadCustomQueues().find((item) => item.id === boxId || item.boxes?.includes(boxId));
  if (custom) return custom.id;

  const status = ticket.status || boxId || '';
  const entries = Object.entries(QUEUE_MAP);
  for (let i = 0; i < entries.length; i++) {
    const [queueId, boxes] = entries[i];
    if (boxes.indexOf(status) >= 0 || boxes.indexOf(boxId) >= 0) return queueId;
  }
  if (boxId === 'novos') return 'novos';
  if (boxId === 'resolvidos') return 'resolvidos';
  if (boxId === 'pendentes' || boxId === 'em-espera') return 'pendente';
  return 'em-andamento';
}

export async function updateTicketInKanban(ticketId, updater) {
  return updateTicketViaApi(ticketId, updater);
}

export async function sendTicketMessage(ticketId, text, author) {
  return addMessageViaApi(ticketId, { text, internal: false, author });
}

export async function addTicketToBox(boxId, ticket) {
  if (isApiMode() && localStorage.getItem('velodesk_token')) {
    const payload = {
      ...ticket,
      status: ticket.status || 'novo',
      boxId,
    };
    const created = await createTicketViaApi(payload);
    return created ? apiTicketToCockpit(created) : null;
  }

  const cols = getKanbanColumns();
  const box = cols.find((c) => c.id === boxId);
  if (!box) return null;
  if (!box.tickets) box.tickets = [];
  const normalized = apiTicketToCockpit(ticket);
  box.tickets.unshift(normalized);
  setCachedColumns(cols);
  return normalized;
}
