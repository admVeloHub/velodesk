/**
 * deskPlatformTrace v1.0.0 — instrumentação enxuta prod + rede local
 * VERSION: v1.0.0 | DATE: 2026-07-27
 *
 * Sempre emite no console (Default level) — prod, localhost e LAN.
 * Ingest remoto opcional: VITE_DESK_TRACE_INGEST_URL ou padrão localhost:7310 em dev.
 * Verbose extra (deskLog): velodeskDebug.enable() ou import.meta.env.DEV
 */
import deskLog from './deskDebugLog';
import { readDeskTraceIngestUrl } from './deskTraceIngestConfig';

const TRACE_PREFIX = '[VeloDesk:trace]';
const SESSION_ID = 'desk-platform';

function runtimeContext() {
  if (typeof window === 'undefined') {
    return { env: 'ssr', host: '', origin: '' };
  }
  let env = 'prod';
  try {
    env = import.meta.env?.PROD ? 'prod' : 'dev';
  } catch {
    env = 'unknown';
  }
  const host = window.location.hostname || '';
  const origin = window.location.origin || '';
  const local =
    host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.local')
    || /^192\.168\.\d+\.\d+$/.test(host)
    || /^10\.\d+\.\d+\.\d+$/.test(host);
  return { env, host, origin, rede: local ? 'local' : 'remota' };
}

function emitConsole(level, event, payload) {
  const line = { event, ...payload };
  if (level === 'warn') console.warn(TRACE_PREFIX, line);
  else if (level === 'error') console.error(TRACE_PREFIX, line);
  else console.info(TRACE_PREFIX, line);
}

function postIngest(event, payload) {
  const url = readDeskTraceIngestUrl();
  if (!url || typeof fetch !== 'function') return;
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        runId: payload.ctx?.env || 'runtime',
        location: payload.area || 'desk',
        message: event,
        data: payload,
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* instrumentação nunca quebra a UI */
  }
}

/**
 * Traço enxuto de comportamento da plataforma — sempre visível no console.
 * @param {string} area — ex.: auto-refresh, tickets-cache
 * @param {string} event — ex.: poll:msgs-mudou
 * @param {object} [detail]
 * @param {'info'|'warn'|'error'} [level]
 */
export function deskPlatformTrace(area, event, detail = {}, level = 'info') {
  const ctx = runtimeContext();
  const payload = {
    area,
    ctx,
    ts: new Date().toISOString(),
    ...detail,
  };

  emitConsole(level, event, payload);
  deskLog.tickets(`${area}:${event}`, payload);
  postIngest(event, payload);
}

export { setDeskTraceIngestUrl, getDeskTraceIngestUrl } from './deskTraceIngestConfig';

export function createPlatformTraceCounter() {
  return Object.create(null);
}

export default deskPlatformTrace;
