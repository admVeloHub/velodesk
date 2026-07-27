/**
 * hubSession v1.1.0 — aliasColaborador na sessão VeloHub
 * VERSION: v1.1.0 | DATE: 2026-07-27
 */

export const HUB_SESSION_STORAGE_KEY = 'hub_session';

function resolveFirstLastName(colaboradorNome) {
  const parts = String(colaboradorNome || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function resolveHubDisplayName(session) {
  const alias = String(session?.aliasColaborador || '').trim();
  if (alias) return alias;
  const fromNome = resolveFirstLastName(session?.colaboradorNome);
  if (fromNome) return fromNome;
  return session?.colaboradorNome || session?.userEmail || '';
}

export function readHubSession() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(HUB_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isHubSessionActive(session) {
  if (!session || typeof session !== 'object') return false;
  if (session.isActive !== true) return false;
  const email = String(session.userEmail || '').trim();
  const sessionId = String(session.sessionId || '').trim();
  return Boolean(email && sessionId);
}

export function hubSessionToUser(session) {
  if (!session) return null;
  return {
    id: session.sessionId || session.userEmail,
    name: resolveHubDisplayName(session),
    email: session.userEmail,
    aliasColaborador: session.aliasColaborador || '',
    colaboradorNome: session.colaboradorNome || '',
    role: 'agent',
    source: 'velohub',
    sessionId: session.sessionId,
  };
}
