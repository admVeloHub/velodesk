/**
 * deskTraceIngestConfig v1.0.0 — URL de ingest da instrumentação Desk
 * VERSION: v1.0.0 | DATE: 2026-07-27
 */
const INGEST_STORAGE_KEY = 'velodesk:trace-ingest-url';
const DEFAULT_DEV_INGEST =
  'http://127.0.0.1:7310/ingest/d227cc0b-a374-4031-bf68-8c0cf44e6004';

export function readDeskTraceIngestUrl() {
  try {
    const fromStorage = String(sessionStorage.getItem(INGEST_STORAGE_KEY) || '').trim();
    if (fromStorage) return fromStorage;
    const fromEnv = String(import.meta.env?.VITE_DESK_TRACE_INGEST_URL || '').trim();
    if (fromEnv) return fromEnv;
    if (import.meta.env?.DEV) return DEFAULT_DEV_INGEST;
  } catch {
    /* ignore */
  }
  return '';
}

export function setDeskTraceIngestUrl(url) {
  try {
    const trimmed = String(url || '').trim();
    if (trimmed) sessionStorage.setItem(INGEST_STORAGE_KEY, trimmed);
    else sessionStorage.removeItem(INGEST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getDeskTraceIngestUrl() {
  return readDeskTraceIngestUrl();
}
