/**
 * ticketsCache v1.10.2 — fingerprint de filas para poll silencioso sem re-render vazio
 * VERSION: v1.10.2 | DATE: 2026-08-03 | AUTHOR: VeloHub Development Team
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
import { syncProconDemandasFromTickets } from './especiais/proconTicketService';

const BOXES_CACHE_KEY = 'velodesk_boxes_cache_v2';
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

/** Assinatura das filas (id + status por box) — poll silencioso só re-renderiza se mudou. */
export function fingerprintQueueColumns(cols) {
  return (cols || [])
    .map((box) => {
      const sig = (box.tickets || [])
        .map((t) => `${String(t.id || t._id)}:${String(t.status || 'novo').trim().toLowerCase()}`)
        .sort()
        .join(',');
      return `${box.id}=${sig}`;
    })
    .join('|');
}

function stripDraftsFromColumns(cols) {
  return (cols || []).map((box) => ({
    ...box,
    tickets: (box.tickets || [])
      .filter((ticket) => !isDraftTicket(ticket))
      .map(sanitizeTicketDetailFlags),
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

function ticketHasDetailContent(ticket) {
  if (!ticket) return false;
  return (ticket.messages?.length || 0) > 0
    || (ticket.internalNotes?.length || 0) > 0
    || (ticket.registroHistorico?.length || 0) > 0;
}

function sanitizeTicketDetailFlags(ticket) {
  if (!ticket || isDraftTicket(ticket)) return ticket;
  if (!ticket._detailLoaded || ticketHasDetailContent(ticket)) return ticket;
  return {
    ...ticket,
    _detailLoaded: false,
    listOnly: true,
    messages: [],
    internalNotes: [],
    registroHistorico: [],
  };
}

function mergePreservedDetails(prevCols, nextCols) {
  const preserved = new Map();
  (prevCols || []).forEach((box) => {
    (box.tickets || []).forEach((ticket) => {
      if (!ticket._detailLoaded || isDraftTicket(ticket)) return;
      if (!ticketHasDetailContent(ticket)) return;
      preserved.set(String(ticket.id || ticket._id), ticket);
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
        workflow: prev.workflow?.pendingPersist
          ? prev.workflow
          : mergeTicketWorkflow(prev.workflow, ticket.workflow),
        lateralForm: prev.workflow?.pendingPersist
          ? {
            ...mergeLateralFormPreservingWorkflow(prev.lateralForm, ticket.lateralForm),
            workflow: prev.lateralForm?.workflow,
          }
          : mergeLateralFormPreservingWorkflow(prev.lateralForm, ticket.lateralForm),
        _pendingWorkflowStart: prev._pendingWorkflowStart,
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
      tickets: (box.tickets || []).map(sanitizeTicketDetailFlags),
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

function resolveBoxIdForTicketStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'em-aberto' || normalized === 'em-andamento') return 'em-andamento';
  if (normalized === 'pendente' || normalized === 'em-espera') return 'em-espera';
  if (normalized === 'resolvido' || normalized === 'cancelado' || normalized === 'fechado') return 'resolvidos';
  return 'novos';
}

function insertTicketIntoColumnsIfMissing(ticket, userEmail = '') {
  const id = String(ticket?.id || ticket?._id || '').trim();
  if (!id) return false;
  if (findInColumns(id)) return false;

  const cols = ensureDefaultColumns();
  const boxId = resolveBoxIdForTicketStatus(ticket.status);
  const box = cols.find((c) => c.id === boxId) || cols[0];
  if (!box) return false;
  if (!box.tickets) box.tickets = [];
  box.tickets.unshift(ticket);
  columns = cols;
  persistColumnsToStorage(cols, userEmail);
  return true;
}

export function patchTicketInCache(ticketId, nextTicket, userEmail = '') {
  const entry = findInColumns(ticketId);
  if (!entry) return false;
  // Substitui o item no array — entry.ticket = x só muda o wrapper local e não atualiza columns.
  entry.box.tickets[entry.index] = nextTicket;
  persistColumnsToStorage(columns, userEmail);
  return true;
}

export async function loadTicketDetailFromApi(ticketId) {
  assertApiReady('carregar ticket');
  deskLog.tickets('loadTicketDetailFromApi → início', { ticketId });
  try {
    const raw = await ticketsApi.get(ticketId);
    if (raw?.listOnly === true) {
      throw new Error('API retornou listagem resumida em vez do detalhe completo');
    }
    const full = apiTicketToCockpit(raw);
    if (!full?.id && !full?._id) {
      throw new Error('Ticket inválido na resposta da API');
    }
    full.listOnly = false;
    full._detailLoaded = true;
    const patched = patchTicketInCache(ticketId, full);
    if (!patched) {
      insertTicketIntoColumnsIfMissing(full);
    }
    try {
      window.dispatchEvent(new CustomEvent('velodesk:ticket-detail-changed', {
        detail: { ticketId: String(ticketId) },
      }));
    } catch {
      /* ignore */
    }
    deskLog.tickets('loadTicketDetailFromApi → ok', {
      ticketId,
      messages: full?.messages?.length || 0,
      internalNotes: full?.internalNotes?.length || 0,
      registroHistorico: full?.registroHistorico?.length || 0,
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
  return (columns || []).map((box) => ({
    ...box,
    tickets: (box.tickets || []).filter((ticket) => {
      if (box.id === 'resolvidos') return true;
      // Novos / Em andamento / Pendente: backend meus-chamados já aplicou responsável
      return true;
    }),
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
    const nextCols = injectDraftTickets(
      adaptColumnsFromApi(data, { fila: params?.fila }),
      drafts,
    );
    // Usa columns no momento do merge (não snapshot no início) — evita apagar detalhe
    // carregado via GET /:id enquanto a listagem /boxes ainda estava em voo.
    columns = filterColumnsForAgent(mergePreservedDetails(columns, nextCols));
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
    const cockpitEntries = columns.flatMap((box) =>
      (box.tickets || []).map((ticket) => ({ ticket, boxId: box.id })),
    );
    syncProconDemandasFromTickets(cockpitEntries);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velodesk:procon-sync'));
    }
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
    if (!Array.isArray(box.tickets)) continue;
    const index = box.tickets.findIndex(
      (x) => String(x.id) === id || String(x._id) === id,
    );
    if (index >= 0) {
      return { ticket: box.tickets[index], box, boxId: box.id, index };
    }
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
    const detailed = await loadTicketDetailFromApi(apiId);
    return detailed || findInColumns(apiId)?.ticket || updated;
  }

  entry.box.tickets[entry.index] = updated;
  return updated;
}

export async function commitTicketViaApi(ticketId, payload) {
  const apiId = String(ticketId);
  if (useApi && !isDraftTicket({ id: apiId })) {
    assertApiReady('salvar ticket');
    await ticketsApi.commit(apiId, payload);
    await loadBoxesFromApi();
    const detailed = await loadTicketDetailFromApi(apiId);
    return detailed || findInColumns(apiId)?.ticket;
  }
  return updateTicketViaApi(ticketId, () => apiTicketToCockpit(payload));
}

export async function addMessageViaApi(ticketId, payload) {
  const apiId = String(ticketId);
  if (useApi && !isDraftTicket({ id: apiId })) {
    assertApiReady('enviar mensagem');
    await ticketsApi.addMessage(apiId, payload);
    await loadBoxesFromApi();
    const detailed = await loadTicketDetailFromApi(apiId);
    return detailed || findInColumns(apiId)?.ticket;
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
  else if (status === 'resolvido' || status === 'cancelado' || status === 'fechado') boxId = 'resolvidos';
  const box = cols.find((c) => c.id === boxId) || cols[0];
  if (box) {
    if (!box.tickets) box.tickets = [];
    box.tickets.unshift(apiTicketToCockpit(newTicket));
    columns = cols;
  }
}
