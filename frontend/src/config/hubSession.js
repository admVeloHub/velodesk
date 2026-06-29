/**
 * hubSession v1.0.0 — leitura da sessão VeloHub (hub_sessions)
 * VERSION: v1.0.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */

export const HUB_SESSION_STORAGE_KEY = 'hub_session';

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
    name: session.colaboradorNome || session.userEmail,
    email: session.userEmail,
    role: 'agent',
    source: 'velohub',
    sessionId: session.sessionId,
  };
}
