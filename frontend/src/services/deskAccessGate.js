/**
 * deskAccessGate v1.1.0 — validação sessão hub + acessos.Desk (sem mock local)
 * VERSION: v1.1.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { fetchColaboradorByEmail } from '../api/velohubApi';
import {
  hubSessionToUser,
  isHubSessionActive,
  readHubSession,
} from '../config/hubSession';

export const GATE_STATUS = {
  AUTHORIZED: 'authorized',
  ACCESS_DENIED: 'access_denied',
  SESSION_INVALID: 'session_invalid',
  ERROR: 'error',
};

function normalizeColaborador(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return raw.data && typeof raw.data === 'object' ? raw.data : raw;
}

function evaluateColaborador(colaborador) {
  if (!colaborador) {
    return { ok: false, reason: 'Colaborador não encontrado' };
  }
  if (colaborador.desligado === true) {
    return { ok: false, reason: 'Colaborador desligado' };
  }
  if (colaborador.afastado === true) {
    return { ok: false, reason: 'Colaborador afastado' };
  }
  const deskAccess = colaborador.acessos?.Desk ?? colaborador.acessos?.desk;
  if (deskAccess !== true) {
    return { ok: false, reason: 'Sem permissão para o Desk' };
  }
  return { ok: true };
}

/**
 * @returns {Promise<{ status: string, user?: object, colaborador?: object, reason?: string }>}
 */
export async function runDeskAccessGate() {
  const session = readHubSession();

  if (!isHubSessionActive(session)) {
    return {
      status: GATE_STATUS.SESSION_INVALID,
      reason: session ? 'Sessão expirada ou inativa' : 'Sessão não encontrada',
    };
  }

  let colaborador;
  try {
    const raw = await fetchColaboradorByEmail(session.userEmail, session.sessionId);
    colaborador = normalizeColaborador(raw);
  } catch (err) {
    return {
      status: GATE_STATUS.ERROR,
      reason: err?.message || 'Falha ao consultar cadastro no VeloHub',
    };
  }

  const check = evaluateColaborador(colaborador);
  if (!check.ok) {
    return {
      status: GATE_STATUS.ACCESS_DENIED,
      reason: check.reason,
      user: hubSessionToUser(session),
      colaborador,
    };
  }

  const user = hubSessionToUser(session);
  if (colaborador.profile_pic) user.profilePic = colaborador.profile_pic;
  if (colaborador.empresa) user.empresa = colaborador.empresa;

  return {
    status: GATE_STATUS.AUTHORIZED,
    user,
    colaborador,
  };
}
