/**
 * workflowInfoNotifications v1.1.0 — pedidos de informação workflow → agente responsável
 */
import { findTicketEntry, getAllCockpitTickets } from '../ticketsStorage';
import {
  buildResponsavelCandidates,
  ticketMatchesAgentResponsavel,
  readDeskProfileId,
} from '../desk/responsavelSegmentation';
import { normalizeProfileId } from '../../config/profiles';

const STORAGE_KEY = 'velodesk_workflow_info_requests';

function readTicketProtocol(ticket) {
  return String(ticket?.chamadoProtocolo || '').trim();
}

function findAnyTicketEntry(ticketId) {
  return findTicketEntry(ticketId);
}

function isDemoInfoRequestTicketId(ticketId) {
  return String(ticketId).startsWith('wf-demo-');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function readTicketResponsavel(ticket) {
  return normalize(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
}

function targetAgentMatchesProfile(targetAgent, profileId = readDeskProfileId()) {
  const target = normalize(targetAgent);
  if (!target) return false;
  if (buildResponsavelCandidates().includes(target)) return true;
  const entry = getAllCockpitTickets().find(({ ticket }) => readTicketResponsavel(ticket) === target);
  return entry ? ticketMatchesAgentResponsavel(entry.ticket, profileId) : false;
}

function findTicketsByProtocol(protocol) {
  const normalized = String(protocol || '').trim();
  if (!normalized) return [];
  return getAllCockpitTickets().filter(
    ({ ticket }) => readTicketProtocol(ticket) === normalized,
  );
}

export function infoRequestMatchesAgent(req, profileId = readDeskProfileId()) {
  if (!req || req.status !== 'pending') return false;

  if (isDemoInfoRequestTicketId(req.ticketId)) {
    return targetAgentMatchesProfile(req.targetAgent, profileId);
  }

  const entry = findAnyTicketEntry(req.ticketId);
  if (entry && ticketMatchesAgentResponsavel(entry.ticket, profileId)) return true;

  const protocolMatches = findTicketsByProtocol(req.protocol);
  if (protocolMatches.some(({ ticket }) => ticketMatchesAgentResponsavel(ticket, profileId))) {
    return true;
  }

  return targetAgentMatchesProfile(req.targetAgent, profileId);
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('velodesk:workflow-info-changed'));
}

export function ticketMatchesInfoRequest(ticket, request) {
  if (!ticket || !request) return false;
  const ticketId = String(ticket.id || ticket._id || '');
  const protocol = readTicketProtocol(ticket);
  if (ticketId && ticketId === String(request.ticketId)) return true;
  const reqProtocol = String(request.protocol || '').trim();
  return Boolean(protocol && reqProtocol && protocol === reqProtocol);
}

export function createWorkflowInfoRequest(payload) {
  const item = {
    id: `wf-info-req-${Date.now()}`,
    ticketId: String(payload.ticketId),
    clientName: payload.clientName || 'Cliente',
    ticketSubject: payload.ticketSubject || '',
    message: String(payload.message || '').trim(),
    requestedBy: payload.requestedBy || 'Operador Workflow',
    targetAgent: payload.targetAgent || '',
    stepLabel: payload.stepLabel || 'Aprovação',
    protocol: payload.protocol || '',
    createdAt: new Date().toISOString(),
    readAt: null,
    status: 'pending',
  };

  const next = [item, ...loadAll()].slice(0, 100);
  saveAll(next);
  return item;
}

export function getWorkflowInfoRequests(profileId = readDeskProfileId()) {
  const normalized = normalizeProfileId(profileId);
  if (normalized !== 'agent') return [];

  return loadAll()
    .filter((req) => req.status === 'pending')
    .filter((req) => infoRequestMatchesAgent(req, profileId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getWorkflowInfoRequestsForTicket(ticket, profileId = readDeskProfileId()) {
  if (!ticket) return [];
  return getWorkflowInfoRequests(profileId).filter((req) => ticketMatchesInfoRequest(ticket, req));
}

export function resolveDeskTicketIdForInfoRequest(request) {
  if (!request) return '';

  const target = normalize(request.targetAgent);
  const protocolMatches = findTicketsByProtocol(request.protocol);

  if (target && protocolMatches.length) {
    const preferred = protocolMatches.find(({ ticket }) => readTicketResponsavel(ticket) === target);
    if (preferred) return String(preferred.ticket.id || preferred.ticket._id);
  }

  if (protocolMatches.length) {
    const agentMatch = protocolMatches.find(({ ticket }) => {
      const responsavel = readTicketResponsavel(ticket);
      return responsavel && buildResponsavelCandidates().includes(responsavel);
    });
    if (agentMatch) return String(agentMatch.ticket.id || agentMatch.ticket._id);
    const first = protocolMatches[0];
    return String(first.ticket.id || first.ticket._id);
  }

  const direct = findTicketEntry(request.ticketId);
  if (direct) return String(direct.ticket.id || direct.ticket._id);

  return String(request.ticketId);
}

function requestMatchesTicketRef(req, ticketId, protocol) {
  if (req.readAt && req.status !== 'pending') return false;
  if (String(req.ticketId) === String(ticketId)) return true;
  const reqProtocol = String(req.protocol || '').trim();
  return Boolean(protocol && reqProtocol && protocol === reqProtocol);
}

export function markWorkflowInfoRequestsReadForTicket(ticketOrId) {
  const ticket = typeof ticketOrId === 'object' ? ticketOrId : null;
  const id = ticket ? String(ticket.id || ticket._id || '') : String(ticketOrId);
  const protocol = ticket ? readTicketProtocol(ticket) : '';
  const now = new Date().toISOString();
  let changed = false;

  const next = loadAll().map((req) => {
    if (req.readAt) return req;
    if (!requestMatchesTicketRef(req, id, protocol)) return req;
    changed = true;
    return { ...req, readAt: now };
  });

  if (changed) saveAll(next);
}

export function resolveWorkflowInfoRequest(ticketOrId) {
  const ticket = typeof ticketOrId === 'object' ? ticketOrId : null;
  const id = ticket ? String(ticket.id || ticket._id || '') : String(ticketOrId);
  const protocol = ticket ? readTicketProtocol(ticket) : '';
  const now = new Date().toISOString();
  let changed = false;

  const next = loadAll().map((req) => {
    if (req.status === 'resolved') return req;
    if (!requestMatchesTicketRef(req, id, protocol)) return req;
    changed = true;
    return { ...req, status: 'resolved', readAt: req.readAt || now };
  });

  if (changed) saveAll(next);
}

export function countUnreadWorkflowInfoRequests(profileId = readDeskProfileId()) {
  return getWorkflowInfoRequests(profileId).filter((req) => !req.readAt).length;
}
