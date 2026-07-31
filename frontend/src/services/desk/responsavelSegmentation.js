/**
 * responsavelSegmentation v1.6.0 — Meus Tickets sempre por responsável atribuído
 * VERSION: v1.6.0 | DATE: 2026-07-30
 */
import { getDeskDisplayName } from '../../utils/userDisplayName';
import { normalizeProfileId } from '../../config/profiles';
import {
  readCachedPermissions,
  shouldUseMeusChamadosFila as permShouldUseMeusChamados,
  hasPermission,
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

export function isGestaoDeskProfile(profileId = readDeskProfileId()) {
  return normalizeProfileId(profileId) === 'gestao';
}

/** Gestão / supervisor / ver_todos: todas as categorias (Novos, Em andamento, Pendente, Resolvidos). */
export function shouldViewAllDeskTickets(profileId = readDeskProfileId()) {
  const perm = readCachedPermissions();
  if (perm && hasPermission(perm.permissoes, 'tickets', 'ver_todos')) return true;
  if (perm && (perm.funcaoSlug === 'gestao' || (perm.funcoes || []).includes('gestao'))) return true;
  if (isGestaoDeskProfile(profileId)) return true;
  if (readAuthDeskRole() === 'supervisor') return true;
  return false;
}

export function shouldUseMeusChamadosFila(profileId = readDeskProfileId()) {
  if (shouldViewAllDeskTickets(profileId)) return false;

  const normalized = normalizeProfileId(profileId);
  if (['gestao', 'workflow'].includes(normalized)) return false;

  const perm = readCachedPermissions();
  if (perm) return permShouldUseMeusChamados(perm);

  const authRole = readAuthDeskRole();
  if (authRole === 'agent') return true;
  if (authRole === 'supervisor') return false;
  return true;
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
  if (shouldViewAllDeskTickets(profileId)) return true;

  const perm = readCachedPermissions();
  if (perm && hasPermission(perm.permissoes, 'tickets', 'ver_todos')) return true;
  if (perm && !permShouldUseMeusChamados(perm)) return true;

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

/**
 * Fila virtual Meus Tickets — sempre exclusiva do usuário logado.
 * Não herda ver_todos/gestão: perfil de gestão vê totais nas outras filas, não aqui.
 */
export function ticketBelongsInMeusTicketsList(ticket) {
  return ticketAssignedToCurrentAgent(ticket);
}

/** Responsável explícito diferente do agente logado (transferência para outro agente). */
export function isResponsavelAssignedToOtherAgent(responsavel) {
  const normalized = normalize(responsavel);
  if (!normalized) return false;
  return !buildResponsavelCandidates().includes(normalized);
}

export { canActOnTicket, filterTicketForUser };
