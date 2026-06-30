/**
 * googleAuthConfig v1.1.0 — Google Identity Services (Desk)
 * VERSION: v1.1.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

function normalizeClientId(raw) {
  return String(raw || '').trim().replace(/^["']|["']$/g, '').trim();
}

export function getGoogleClientId() {
  return normalizeClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}
