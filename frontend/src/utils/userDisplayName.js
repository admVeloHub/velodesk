/**
 * userDisplayName v1.0.0 — nome de exibição a partir do e-mail
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export function getEmailLocalPart(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized || '';
  return normalized.split('@')[0];
}

export function getDeskDisplayName(userOrEmail) {
  if (!userOrEmail) return '';
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail.email;
  return getEmailLocalPart(email);
}

export function isLegacyDeskUser(user) {
  if (!user || typeof user !== 'object') return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return true;
  if (email === 'admin@velodesk.local') return true;
  if (user.source === 'dev-local') return true;
  return false;
}
