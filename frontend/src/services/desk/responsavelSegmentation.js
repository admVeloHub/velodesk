/**
 * responsavelSegmentation v1.2.0 — novos sem responsavel = fila compartilhada
 * VERSION: v1.2.0 | DATE: 2026-07-03 | AUTHOR: VeloHub Development Team
 */
import { getDeskDisplayName } from '../../utils/userDisplayName';

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
    return localStorage.getItem('velodeskProfile') || 'agent';
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
  const authRole = readAuthDeskRole();
  if (authRole === 'agent') return true;
  if (authRole === 'supervisor') return false;
  return profileId !== 'supervisor';
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
  if (!shouldUseMeusChamadosFila(profileId)) return true;

  const responsavel = normalize(ticket?.lateralForm?.responsavel || ticket?.responsibleAgent);
  const status = normalize(ticket?.status || '');

  if (!responsavel && status === 'novo') return true;
  if (!responsavel) return false;

  const candidates = buildResponsavelCandidates();
  return candidates.includes(responsavel);
}
