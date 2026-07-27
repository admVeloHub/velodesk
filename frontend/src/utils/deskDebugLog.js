/**
 * deskDebugLog v1.0.1 — console de diagnóstico forçável (usa console.log, não debug)
 * VERSION: v1.0.1 | DATE: 2026-07-27
 *
 * Ativar:  localStorage.setItem('velodesk:debug', '1'); location.reload();
 * Desativar: localStorage.removeItem('velodesk:debug'); location.reload();
 * Ou no console: velodeskDebug.enable() / velodeskDebug.disable()
 */
import { setDeskTraceIngestUrl, getDeskTraceIngestUrl } from './deskTraceIngestConfig';

const STORAGE_KEY = 'velodesk:debug';
const PREFIX = '[VeloDesk]';

let bannerPrinted = false;

function readStorageFlag() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === '1' || raw === 'true' || raw === 'on';
  } catch {
    return false;
  }
}

function writeStorageFlag(enabled) {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isDeskDebugEnabled() {
  if (readStorageFlag()) return true;
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function emit(level, tag, message, detail) {
  if (!isDeskDebugEnabled()) return;
  const label = tag ? `${PREFIX} ${tag}` : PREFIX;
  const payload = detail === undefined ? message : [message, detail];
  if (level === 'warn') console.warn(label, payload);
  else if (level === 'error') console.error(label, payload);
  else console.log(label, payload);
}

export const deskLog = {
  info(tag, message, detail) {
    emit('log', tag, message, detail);
  },
  warn(tag, message, detail) {
    emit('warn', tag, message, detail);
  },
  error(tag, message, detail) {
    emit('error', tag, message, detail);
  },
  api(method, url, detail) {
    emit('log', 'API', `${method?.toUpperCase?.() || method} ${url}`, detail);
  },
  apiError(method, url, detail) {
    emit('error', 'API', `${method?.toUpperCase?.() || method} ${url} FALHOU`, detail);
  },
  tickets(message, detail) {
    emit('log', 'TICKETS', message, detail);
  },
  workflow(message, detail) {
    emit('log', 'WORKFLOW', message, detail);
  },
  requisicao(message, detail) {
    emit('log', 'REQUISICAO', message, detail);
  },
  perm(message, detail) {
    emit('log', 'PERMISSOES', message, detail);
  },
};

export function initDeskDebug() {
  if (typeof window === 'undefined') return;

  window.velodeskDebug = {
    isEnabled: isDeskDebugEnabled,
    enable() {
      writeStorageFlag(true);
      console.log(`${PREFIX} debug ATIVADO — recarregue a página (F5)`);
    },
    disable() {
      writeStorageFlag(false);
      console.log(`${PREFIX} debug DESATIVADO — recarregue a página (F5)`);
    },
    toggle() {
      if (isDeskDebugEnabled()) window.velodeskDebug.disable();
      else window.velodeskDebug.enable();
    },
    setTraceIngest(url) {
      setDeskTraceIngestUrl(url);
      console.log(`${PREFIX} trace ingest →`, getDeskTraceIngestUrl() || '(desativado — só console)');
    },
    getTraceIngest: getDeskTraceIngestUrl,
  };

  if (!isDeskDebugEnabled() || bannerPrinted) return;
  bannerPrinted = true;

  console.log(
    `%c${PREFIX} diagnóstico ATIVO`,
    'color:#1634FF;font-weight:bold',
    '\n→ API, tickets, workflow e requisição logam aqui (console.log, nível Default).\n'
    + '→ Desativar: velodeskDebug.disable() + F5\n'
    + '→ Forçar sempre: localStorage.setItem("velodesk:debug","1") + F5',
  );
}

export default deskLog;
