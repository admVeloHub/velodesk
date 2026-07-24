/**
 * ticketsCache v1.9.2 — merge lateralForm.workflow.requisicao.comunicacaoWorkflow
 * VERSION: v1.9.2 | DATE: 2026-07-24 | AUTHOR: VeloHub Development Team
 */
import { boxesApi, ticketsApi } from '../api/client';
import { isBackendJwtUsable } from '../utils/backendJwt';
import deskLog from '../utils/deskDebugLog';
import {
  adaptColumnsFromApi,
  apiTicketToCockpit,
  cockpitTicketToApi,
  buildCreatePayload,
  isDraftTicket,
} from '../api/adapters/ticketAdapter';
import { readDeskProfileId, shouldUseMeusChamadosFila, ticketMatchesAgentResponsavel } from './desk/responsavelSegmentation';
import { getAgentName } from './clientDb';

const BOXES_CACHE_KEY = 'velodesk_boxes_cache_v1';
const BOXES_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let columns = [];
let useApi = true;

const DEFAULT_BOXES = [
  { id: 'novos', name: 'Novos', tickets: [] },
  { id: 'em-andamento', name: 'Em Andamento', tickets: [] },
  { id: 'em-espera', name: 'Pendente', tickets: [] },
  { id: 'pendentes', name: 'Aguardando retorno', tickets: [] },
  { id: 'resolvidos', name: 'Resolvidos', tickets: [] },
];

function ensureDefaultColumns() {
  if (!columns.length) {
    columns = DEFAULT_BOXES.map((box) => ({ ...box, tickets: [...(box.tickets || [])] }));
  }
  return columns;
}

function collectDraftTickets(cols) {
  const drafts = [];
  (cols || []).forEach((box) => {
    (box.tickets || []).forEach((t) => {
      if (isDraftTicket(t)) drafts.push({ ticket: t, boxId: box.id });
    });
  });
  return drafts;
}

function injectDraftTickets(cols, drafts) {
  if (!drafts.length) return cols;
  const next = cols.map((box) => ({ ...box, tickets: [...(box.tickets || [])] }));
  drafts.forEach(({ ticket, boxId }) => {
    const id = String(ticket.id || ticket._id);
    next.forEach((box) => {
      box.tickets = (box.tickets || []).filter(
        (t) => String(t.id) !== id && String(t._id) !== id
      );
    });
    const target = next.find((b) => b.id === boxId) || next.find((b) => b.id === 'novos') || next[0];
    if (target) {
      if (!target.tickets) target.tickets = [];
      target.tickets.unshift(ticket);
    }
  });
  return next;
}

export { isDraftTicket };

export function isApiMode() {
  return useApi;
}

export function setApiMode(enabled) {
  useApi = enabled;
}

export function getCachedColumns() {
  return columns;
}

function stripDraftsFromColumns(cols) {
  return (cols || []).map((box) => ({
    ...box,
    tickets: (box.tickets || []).filter((ticket) => !isDraftTicket(ticket)),
  }));
}

function mergeTicketWorkflow(prev, next) {
  if (!next) return prev;
  if (!prev) return next;
  if (!next.requisicao) {
    return { ...prev, ...next, requisicao: prev.requisicao };
  }
  const prevReq = prev.requisicao || {};
  const nextReq = next.requisicao || {};
  const hasNextComunicacao = Array.isArray(nextReq.comunicacaoWorkflow);
  const comunicacaoWorkflow = hasNextComunicacao
    ? nextReq.comunicacaoWorkflow
    : (prevReq.comunicacaoWorkflow || []);
  return {
    ...prev,
    ...next,
    requisicao: {
      ...prevReq,
      ...nextReq,
      valores: nextReq.valores ?? prevReq.valores,
      comunicacaoWorkflow,
      comunicacaoPendente: nextReq.comunicacaoPendente
        ?? prevReq.comunicacaoPendente
        ?? comunicacaoWorkflow.length > 0,
    },
  };
}

function mergeLateralFormPreservingWorkflow(prevLf = {}, nextLf = {}) {
  const merged = { ...prevLf, ...nextLf };
  const prevWf = prevLf.workflow || {};
  const nextWf = nextLf.workflow;
  if (!nextWf) {
    merged.workflow = prevLf.workflow;
    return merged;
  }
  merged.workflow = {
    ...prevWf,
    ...nextWf,
    requisicao: mergeTicketWorkflow(
      { requisicao: prevWf.requisicao },
      { requisicao: nextWf.requisicao },
    ).requisicao,
  };
  return merged;
}

function mergePreservedDetails(prevCols, nextCols) {
  const preserved = new Map();
  (prevCols || []).forEach((box) => {
    (box.tickets || []).forEach((ticket) => {
      if (ticket._detailLoaded && !isDraftTicket(ticket)) {
        preserved.set(String(ticket.id || ticket._id), ticket);
      }
    });
  });
  if (!preserved.size) return nextCols;
  return nextCols.map((box) => ({
    ...box,
    tickets: (box.tickets || []).map((ticket) => {
      const id = String(ticket.id || ticket._id);
      const prev = preserved.get(id);
      if (!prev) return ticket;
      return {
        ...prev,
        status: ticket.status,
        updatedAt: ticket.updatedAt,
        createdAt: ticket.createdAt,
        boxId: ticket.boxId,
        clientName: ticket.clientName ?? prev.clientName,
        responsibleAgent: ticket.responsibleAgent ?? prev.responsibleAgent,
        slaBreached: ticket.slaBreached ?? prev.slaBreached,
        workflow: mergeTicketWorkflow(prev.workflow, ticket.workflow),
        lateralForm: mergeLateralFormPreservingWorkflow(prev.lateralForm, ticket.lateralForm),
        listOnly: false,
        _detailLoaded: true,
      };
    }),
  }));
}

function persistColumnsToStorage(cols, userEmail = '') {
  try {
    const payload = {
      savedAt: Date.now(),
      userEmail: String(userEmail || '').trim().toLowerCase(),
      columns: stripDraftsFromColumns(cols),
    };
    localStorage.setItem(BOXES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota ou modo privado */
  }
}

export function hydrateColumnsFromStorage(expectedEmail = '') {
  try {
    const raw = localStorage.getItem(BOXES_CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.columns?.length) return false;
    if (Date.now() - Number(parsed.savedAt || 0) > BOXES_CACHE_MAX_AGE_MS) return false;
    const normalizedExpected = String(expectedEmail || '').trim().toLowerCase();
    const normalizedStored = String(parsed.userEmail || '').trim().toLowerCase();
    if (normalizedExpected && normalizedStored && normalizedExpected !== normalizedStored) return false;
    columns = parsed.columns.map((box) => ({
      ...box,
      tickets: [...(box.tickets || [])],
    }));
    return true;
  } catch {
    return false;
  }
}

export function setCachedColumns(next, userEmail = '') {
  columns = next;
  persistColumnsToStorage(next, userEmail);
}

export function patchTicketInCache(ticketId, nextTicket, userEmail = '') {
  const entry = findInColumns(ticketId);
  if (!entry) return false;
  entry.ticket = nextTicket;
  persistColumnsToStorage(columns, userEmail);
  return true;
}

export async function loadTicketDetailFromApi(ticketId) {
  assertApiReady('carregar ticket');
  deskLog.tickets('loadTicketDetailFromApi → início', { ticketId });
  try {
    const raw = await ticketsApi.get(ticketId);
    const full = apiTicketToCockpit(raw);
    full.listOnly = false;
    full._detailLoaded = true;
    patchTicketInCache(ticketId, full);
    deskLog.tickets('loadTicketDetailFromApi → ok', {
      ticketId,
      requisicao: full?.workflow?.requisicao?.valores || {},
      listOnly: full.listOnly,
    });
    return full;
  } catch (err) {
    deskLog.error('TICKETS', 'loadTicketDetailFromApi → falhou', {
      ticketId,
      status: err?.response?.status,
      message: err?.response?.data?.message || err?.message,
    });
    throw err;
  }
}

function assertApiReady(action = 'salvar ticket') {
  if (!useApi) {
    throw new Error(`Modo offline: não foi possível ${action}. Ative a integração com o backend.`);
  }
  if (!localStorage.getItem('velodesk_token')) {
    throw new Error(`Sessão do backend indisponível. Recarregue a página para reconectar antes de ${action}.`);
  }
}

function filterColumnsForAgent(columns) {
  if (!shouldUseMeusChamadosFila()) return columns;
  const profileId = readDeskProfileId();
  return (columns || []).map((box) => ({
    ...box,
    tickets: (box.tickets || []).filter((ticket) => ticketMatchesAgentResponsavel(ticket, profileId)),
  }));
}

export async function loadBoxesFromApi(userEmail = '') {
  const token = localStorage.getItem('velodesk_token');
  if (!useApi || !isBackendJwtUsable(token)) {
    deskLog.tickets('loadBoxesFromApi → skip (sem API/token)', { useApi, hasToken: Boolean(token) });
    return columns;
  }
  const drafts = collectDraftTickets(columns);
  deskLog.tickets('loadBoxesFromApi → início', { userEmail });
  try {
    const profileId = readDeskProfileId();
    const params = shouldUseMeusChamadosFila(profileId) ? { fila: 'meus-chamados' } : undefined;
    const data = await boxesApi.list(params);
    const prevColumns = columns;
    columns = filterColumnsForAgent(
      mergePreservedDetails(
        prevColumns,
        injectDraftTickets(adaptColumnsFromApi(data, { fila: params?.fila }), drafts),
      ),
    );
    persistColumnsToStorage(columns, userEmail);
    const ticketCount = columns.reduce((n, box) => n + (box.tickets?.length || 0), 0);
    const withRequisicao = columns.flatMap((b) => b.tickets || [])
      .filter((t) => t?.workflow?.requisicao?.valores && Object.keys(t.workflow.requisicao.valores).length);
    deskLog.tickets('loadBoxesFromApi → ok', {
      boxes: columns.length,
      tickets: ticketCount,
      comRequisicao: withRequisicao.length,
      amostraRequisicao: withRequisicao.slice(0, 3).map((t) => ({
        id: t.id,
        valores: t.workflow.requisicao.valores,
      })),
    });
  } catch (err) {
    const message = err?.response?.data?.message || err?.message || 'Erro desconhecido';
    deskLog.error('TICKETS', 'loadBoxesFromApi → falhou', {
      status: err?.response?.status,
      message,
    });
    console.warn('ticketsCache: falha ao carregar boxes', message);
    throw err;
  }
  return columns;
}

export function addCustomBox(box) {
  const cols = ensureDefaultColumns();
  if (cols.some((col) => col.id === box.id)) {
    return cols.find((col) => col.id === box.id);
  }
  const nextBox = { id: box.id, name: box.name, action: box.action, tickets: [] };
  columns = [...cols, nextBox];
  return nextBox;
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

function removeTicketFromColumns(ticketId) {
  const id = String(ticketId);
  columns.forEach((box) => {
    if (!box.tickets) return;
    box.tickets = box.tickets.filter((t) => String(t.id) !== id && String(t._id) !== id);
  });
}

export async function updateTicketViaApi(ticketId, updater) {
  const entry = findInColumns(ticketId);
  if (!entry) return null;

  const draft = { ...entry.ticket };
  const updated = typeof updater === 'function' ? updater(draft) : updater;
  const apiId = updated._id || updated.id;

  if (useApi && apiId && !isDraftTicket(updated)) {
    assertApiReady('atualizar ticket');
    await ticketsApi.update(apiId, cockpitTicketToApi(updated));
    await loadBoxesFromApi();
    return findInColumns(apiId)?.ticket || updated;
  }

  entry.ticket = updated;
  return updated;
}

export async function addMessageViaApi(ticketId, payload) {
  const apiId = String(ticketId);
  if (useApi && !isDraftTicket({ id: apiId })) {
    assertApiReady('enviar mensagem');
    await ticketsApi.addMessage(apiId, payload);
    await loadBoxesFromApi();
    return findInColumns(apiId)?.ticket;
  }
  return updateTicketViaApi(ticketId, (t) => {
    const isInternalOnly = Boolean(payload.internal);
    const publicText = isInternalOnly ? '' : String(payload.text ?? '').trim();
    const internalText = isInternalOnly
      ? String(payload.text ?? '').trim()
      : String(payload.internalText ?? payload.anotacaoInterna ?? '').trim();

    if (!publicText && !internalText) return t;

    const regKey = Date.now();
    const ts = new Date().toISOString();
    const author = payload.author || getAgentName() || '';

    if (publicText) {
      if (!t.messages) t.messages = [];
      t.messages.push({
        id: `${regKey}-pub`,
        type: 'agent',
        fromClient: false,
        origin: 'agente',
        text: publicText,
        timestamp: ts,
        author,
      });
    }
    if (internalText) {
      if (!t.internalNotes) t.internalNotes = [];
      t.internalNotes.push({
        id: `${regKey}-int`,
        type: 'internal',
        origin: 'agente',
        text: internalText,
        timestamp: ts,
        author,
      });
    }
    t.updatedAt = ts;
    return t;
  });
}

export function createDraftTicketInCache(form) {
  const cols = ensureDefaultColumns();
  const boxId = form.boxId || 'novos';
  const box = cols.find((col) => col.id === boxId) || cols[0];
  const now = new Date().toISOString();
  const id = `draft-${Date.now()}`;
  const payload = buildCreatePayload(form);
  const ticket = apiTicketToCockpit({
    ...payload,
    ...form,
    id,
    _id: id,
    isDraft: true,
    status: 'novo',
    createdAt: now,
    updatedAt: now,
    messages: [],
    internalNotes: [],
  });

  if (ticket.lateralForm && !String(ticket.lateralForm.produto || '').trim()) {
    ticket.lateralForm.produto = '';
    ticket.lateralForm.motivo = '';
    ticket.lateralForm.detalhe = '';
  }

  if (!box.tickets) box.tickets = [];
  box.tickets.unshift(ticket);
  columns = cols;
  return ticket;
}

export async function persistDraftTicket(ticket, messageText) {
  const draftId = String(ticket._id || ticket.id);
  assertApiReady('registrar o ticket no MongoDB');
  const payload = cockpitTicketToApi(ticket);
  if (messageText && String(messageText).trim()) {
    payload.text = String(messageText).trim();
    payload.description = payload.text;
  }
  const created = await ticketsApi.create(payload);
  const persisted = apiTicketToCockpit(created);
  removeTicketFromColumns(draftId);
  await loadBoxesFromApi();
  const entry = findInColumns(persisted.id || persisted._id);
  if (!entry) {
    const cols = ensureDefaultColumns();
    const box = cols.find((c) => c.id === 'novos') || cols[0];
    if (box) {
      if (!box.tickets) box.tickets = [];
      box.tickets.unshift(persisted);
      columns = cols;
    }
  }
  return persisted;
}

export async function createTicketViaApi(payload) {
  assertApiReady('criar ticket');
  const created = await ticketsApi.create(cockpitTicketToApi(buildCreatePayload(payload)));
  await loadBoxesFromApi();
  return apiTicketToCockpit(created);
}

export function replaceDraftIdInColumns(oldId, newTicket) {
  removeTicketFromColumns(oldId);
  const cols = ensureDefaultColumns();
  const status = newTicket.status || 'novo';
  let boxId = 'novos';
  if (status === 'em-aberto' || status === 'em-andamento') boxId = 'em-andamento';
  else if (status === 'pendente' || status === 'em-espera') boxId = 'em-espera';
  else if (status === 'resolvido' || status === 'cancelado') boxId = 'resolvidos';
  const box = cols.find((c) => c.id === boxId) || cols[0];
  if (box) {
    if (!box.tickets) box.tickets = [];
    box.tickets.unshift(apiTicketToCockpit(newTicket));
    columns = cols;
  }
}
