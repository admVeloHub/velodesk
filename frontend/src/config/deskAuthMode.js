/**
 * deskAuthMode v1.0.0 — google (fase testes) | velohub (gate futuro)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export function getDeskAuthMode() {
  return (import.meta.env.VITE_DESK_AUTH_MODE || 'google').trim().toLowerCase();
}

export function isGoogleDeskAuthMode() {
  return getDeskAuthMode() === 'google';
}

export function isVelohubDeskAuthMode() {
  return getDeskAuthMode() === 'velohub';
}

export function readStoredDeskAuthMode() {
  try {
    return localStorage.getItem('velodesk_auth_mode') || '';
  } catch {
    return '';
  }
}

export function isGoogleDeskSession(user) {
  return user?.source === 'google-desk' || readStoredDeskAuthMode() === 'google';
}
