/**
 * velohubApiConfig v1.2.0 — base URL da API VeloHub
 * VERSION: v1.2.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

import { readRuntimeEnv } from './runtimeEnv';

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

  const raw = readRuntimeEnv('VITE_VELOHUB_API_URL').replace(/\/$/, '');
  return normalizeRemoteBase(raw);
}

export function requireVelohubApiBaseUrl() {
  const base = getVelohubApiBaseUrl();
  if (!base) {
    throw new Error('VITE_VELOHUB_API_URL não configurada');
  }
  return base;
}
