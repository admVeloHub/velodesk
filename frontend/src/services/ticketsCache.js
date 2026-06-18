/**
 * ticketsCache v1.0.0 — cache em memória sincronizado com API
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import { boxesApi, ticketsApi } from '../api/client';
import { adaptColumnsFromApi, apiTicketToCockpit, cockpitTicketToApi } from '../api/adapters/ticketAdapter';

let columns = [];
let useApi = true;

export function isApiMode() {
  return useApi;
}

export function setApiMode(enabled) {
  useApi = enabled;
}

export function getCachedColumns() {
  return columns;
}

export function setCachedColumns(next) {
  columns = next;
}

export async function loadKanbanFromApi() {
  if (!useApi || !localStorage.getItem('velodesk_token')) {
    return columns;
  }
  try {
    const data = await boxesApi.list();
    columns = adaptColumnsFromApi(data);
  } catch (err) {
    console.warn('ticketsCache v1.0.0: falha ao carregar boxes', err.message);
  }
  return columns;
}

function findInColumns(ticketId) {
  const id = String(ticketId);
  for (let i = 0; i < columns.length; i++) {
    const box = columns[i];
    const t = (box.tickets || []).find((x) => String(x.id) === id || String(x._id) === id);
    if (t) return { ticket: t, box, boxId: box.id };
  }
  return null;
}

export async function updateTicketViaApi(ticketId, updater) {
  const entry = findInColumns(ticketId);
  if (!entry) return null;

  const draft = { ...entry.ticket };
  const updated = typeof updater === 'function' ? updater(draft) : updater;
  const apiId = updated._id || updated.id;

  if (useApi && localStorage.getItem('velodesk_token') && apiId && !String(apiId).startsWith('draft-')) {
    await ticketsApi.update(apiId, cockpitTicketToApi(updated));
    await loadKanbanFromApi();
    return findInColumns(apiId)?.ticket || updated;
  }

  entry.ticket = updated;
  return updated;
}

export async function addMessageViaApi(ticketId, payload) {
  const apiId = String(ticketId);
  if (useApi && localStorage.getItem('velodesk_token') && !apiId.startsWith('draft-')) {
    await ticketsApi.addMessage(apiId, payload);
    await loadKanbanFromApi();
    return findInColumns(apiId)?.ticket;
  }
  return updateTicketViaApi(ticketId, (t) => {
    if (!t.messages) t.messages = [];
    t.messages.push({
      type: payload.internal ? 'internal' : 'agent',
      fromClient: false,
      text: payload.text,
      timestamp: new Date().toISOString(),
      author: payload.author || 'Agente',
    });
    t.updatedAt = new Date().toISOString();
    return t;
  });
}

export async function createTicketViaApi(payload) {
  if (useApi && localStorage.getItem('velodesk_token')) {
    const created = await ticketsApi.create(payload);
    await loadKanbanFromApi();
    return apiTicketToCockpit(created);
  }
  return null;
}
