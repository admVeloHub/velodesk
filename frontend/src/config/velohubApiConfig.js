/**
 * velohubApiConfig v1.1.0 — base URL da API VeloHub
 * VERSION: v1.1.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export const VELOHUB_API_PROXY_PREFIX = '/velohub-api';

function normalizeRemoteBase(raw) {
  if (!raw) return '';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export function getVelohubApiBaseUrl() {
  // Dev local: proxy Vite evita CORS (Desk :8000 não está na allowlist do VeloHub Cloud Run)
  if (import.meta.env.DEV) {
    return VELOHUB_API_PROXY_PREFIX;
  }

  const raw = (import.meta.env.VITE_VELOHUB_API_URL || '').trim().replace(/\/$/, '');
  return normalizeRemoteBase(raw);
}

export function requireVelohubApiBaseUrl() {
  const base = getVelohubApiBaseUrl();
  if (!base) {
    throw new Error('VITE_VELOHUB_API_URL não configurada');
  }
  return base;
}
