/**
 * googleAuthConfig v1.2.0 — Google Identity Services (Desk)
 * VERSION: v1.2.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

import { readRuntimeEnv } from './runtimeEnv';

function normalizeClientId(raw) {
  return String(raw || '').trim().replace(/^["']|["']$/g, '').trim();
}

export function getGoogleClientId() {
  return normalizeClientId(readRuntimeEnv('VITE_GOOGLE_CLIENT_ID'));
}
