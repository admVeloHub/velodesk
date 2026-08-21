/**
 * responsavelDisplay v1.0.0 — exibição: alias ou primeiro+último (nunca e-mail/login)
 * VERSION: v1.0.0 | DATE: 2026-08-20
 */
import {
  buildResponsavelDisplayIndex,
  looksLikeNonDisplayResponsavelToken,
  resolveAgentDisplayName,
} from '../../utils/userDisplayName';

let displayIndex = new Map();

function readStoredColaborador() {
  try {
    const raw = localStorage.getItem('velodesk_colaborador');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem('velodesk_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Atualiza índice global a partir da lista Desk (hook de colaboradores). */
export function setResponsavelDisplayColaboradores(colaboradores = []) {
  const list = Array.isArray(colaboradores) ? colaboradores : [];
  const sessionCol = readStoredColaborador();
  const sessionUser = readStoredUser();
  const extras = [];
  if (sessionCol) extras.push({ raw: sessionCol, email: sessionCol.userMail || sessionUser?.email });
  displayIndex = buildResponsavelDisplayIndex([...list, ...extras]);
}

function resolveFromIndex(raw) {
  const stored = String(raw ?? '').trim();
  if (!stored) return '';
  const keys = [
    stored.toLowerCase(),
    stored.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' '),
  ];
  for (let i = 0; i < keys.length; i += 1) {
    const hit = displayIndex.get(keys[i]);
    if (hit) return hit;
  }
  return '';
}

/** Formata responsável para UI — nunca retorna e-mail ou login. */
export function formatResponsavelForDisplay(raw) {
  const stored = String(raw ?? '').trim();
  if (!stored) return '';

  const resolved = resolveFromIndex(stored);
  if (resolved) return resolved;

  if (looksLikeNonDisplayResponsavelToken(stored)) return '';

  const sessionCol = readStoredColaborador();
  const sessionUser = readStoredUser();
  const sessionMail = String(sessionCol?.userMail || sessionUser?.email || '').trim().toLowerCase();
  if (sessionMail && stored.toLowerCase() === sessionMail) {
    return resolveAgentDisplayName({
      aliasColaborador: sessionCol?.aliasColaborador || sessionUser?.aliasColaborador,
      colaboradorNome: sessionCol?.colaboradorNome || sessionUser?.colaboradorNome,
    });
  }

  return stored;
}

/** Normaliza ticket vindo da API/cache — lateralForm.responsavel sempre legível. */
export function applyResponsavelDisplayToTicket(ticket) {
  if (!ticket || typeof ticket !== 'object') return ticket;
  const lf = ticket.lateralForm || {};
  const raw = lf.responsavel || ticket.responsibleAgent || '';
  const display = formatResponsavelForDisplay(raw);
  if (!display) {
    if (looksLikeNonDisplayResponsavelToken(raw)) {
      return {
        ...ticket,
        responsibleAgent: '',
        lateralForm: {
          ...lf,
          responsavel: '',
        },
      };
    }
    return ticket;
  }
  return {
    ...ticket,
    responsibleAgent: display,
    lateralForm: {
      ...lf,
      responsavel: display,
    },
  };
}

// Semente mínima da sessão logada (antes do GET /colaboradores).
setResponsavelDisplayColaboradores([]);
