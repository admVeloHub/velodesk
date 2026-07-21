/**
 * responsavelSegmentation v1.4.1 — ticketAssignedToCurrentAgent para Meus Tickets
 * VERSION: v1.4.1 | DATE: 2026-07-21
 */
import { getDeskDisplayName } from '../../utils/userDisplayName';
import { normalizeProfileId } from '../../config/profiles';
import {
  readCachedPermissions,
  shouldUseMeusChamadosFila as permShouldUseMeusChamados,
  ticketMatchesAgentResponsavel as permTicketMatches,
  canActOnTicket,
  filterTicketForUser,
} from '../permissions/permissionService';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function emailLocalPart(email) {
  const normalized = normalize(email);
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0] ?? '';
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('velodesk_user') || '{}');
  } catch {
    return {};
  }
}

function readStoredColaborador() {
  try {
    return JSON.parse(localStorage.getItem('velodesk_colaborador') || 'null');
  } catch {
    return null;
  }
}

export function readDeskProfileId() {
  try {
    return normalizeProfileId(localStorage.getItem('velodeskProfile') || 'agent');
  } catch {
    return 'agent';
  }
}

/** Papel operacional da sessão (JWT / login) — prevalece sobre perfil UI desatualizado */
export function readAuthDeskRole() {
  const user = readStoredUser();
  const role = String(user?.deskProfile || user?.role || '').trim().toLowerCase();
  if (role === 'agent' || role === 'supervisor') return role;
  return null;
}

export function shouldUseMeusChamadosFila(profileId = readDeskProfileId()) {
  const perm = readCachedPermissions();
  if (perm) return permShouldUseMeusChamados(perm);

  const authRole = readAuthDeskRole();
  if (authRole === 'agent') return true;
  if (authRole === 'supervisor') return false;
  const normalized = normalizeProfileId(profileId);
  return !['gestao', 'workflow'].includes(normalized);
}

export function buildResponsavelCandidates() {
  const user = readStoredUser();
  const colaborador = readStoredColaborador();
  const values = [];
  const push = (raw) => {
    const value = normalize(raw);
    if (value) values.push(value);
  };

  push(user.name);
  push(user.email);
  push(emailLocalPart(user.email));
  push(user.id);
  push(colaborador?.nome);
  push(colaborador?.colaboradorNome);
  push(colaborador?.email);
  push(getDeskDisplayName(user));

  return [...new Set(values.filter(Boolean))];
}

export function ticketMatchesAgentResponsavel(ticket, profileId = readDeskProfileId()) {
  const perm = readCachedPermissions();
  if (perm) return filterTicketForUser(ticket, perm);

  if (!shouldUseMeusChamadosFila(profileId)) return true;

  const responsavel = normalize(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
  const status = normalize(ticket?.status || '');

  if (!responsavel && status === 'novo') return true;
  if (!responsavel) return false;

  const candidates = buildResponsavelCandidates();
  return candidates.includes(responsavel);
}

/** Apenas tickets com responsável explícito igual ao agente logado. */
export function ticketAssignedToCurrentAgent(ticket) {
  const responsavel = normalize(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
  if (!responsavel) return false;
  const candidates = buildResponsavelCandidates();
  return candidates.includes(responsavel);
}

export { canActOnTicket, filterTicketForUser };
