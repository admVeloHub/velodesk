/**
 * runtimeEnv v1.0.0 — leitura de env build (Vite) + runtime (Cloud Run env-config.js)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export function readRuntimeEnv(key) {
  const build = import.meta.env[key];
  if (build != null && String(build).trim() !== '') return String(build).trim();

  const runtime = typeof window !== 'undefined' ? window.__VELODESK_ENV__ : null;
  const value = runtime?.[key];
  return value != null ? String(value).trim() : '';
}
