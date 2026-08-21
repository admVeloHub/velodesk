/**
 * deskDebugLog v2.3.0 — logs legíveis (sem Array(2) no console)
 * VERSION: v2.3.0 | DATE: 2026-08-20
 *
 * Por padrão: API, tickets, workflow, permissões e erros logam no console (nível Default).
 * Desativar: velodeskDebug.disable() + F5  ou  localStorage.setItem('velodesk:debug','0') + F5
 * Reativar:   velodeskDebug.enable() + F5  ou  localStorage.setItem('velodesk:debug','1') + F5
 */
import { setDeskTraceIngestUrl, getDeskTraceIngestUrl } from './deskTraceIngestConfig';

const STORAGE_KEY = 'velodesk:debug';
const PREFIX = '[VeloDesk]';

let bannerPrinted = false;

function readStorageRaw() {
  try {
    return String(localStorage.getItem(STORAGE_KEY) ?? '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function writeStorageFlag(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** true por padrão — só desliga com velodesk:debug = 0|false|off */
export function isDeskDebugEnabled() {
  const raw = readStorageRaw();
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

function emit(level, tag, message, detail) {
  if (!isDeskDebugEnabled()) return;
  const label = tag ? `${PREFIX} ${tag}` : PREFIX;
  const text = String(message ?? '');
  if (detail === undefined) {
    if (level === 'warn') console.warn(label, text);
    else if (level === 'error') console.error(label, text);
    else console.info(label, text);
    return;
  }
  if (level === 'warn') console.warn(label, text, detail);
  else if (level === 'error') console.error(label, text, detail);
  else console.info(label, text, detail);
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
  /** Ação do usuário / commit / navegação — sempre visível quando debug ativo (padrão). */
  action(message, detail) {
    emit('log', 'AÇÃO', message, detail);
  },
};

export function initDeskDebug() {
  if (typeof window === 'undefined') return;

  window.velodeskDebug = {
    isEnabled: isDeskDebugEnabled,
    enable() {
      writeStorageFlag(true);
      console.log(`${PREFIX} console operacional ATIVADO — recarregue a página (F5)`);
    },
    disable() {
      writeStorageFlag(false);
      console.log(`${PREFIX} console operacional DESATIVADO — recarregue a página (F5)`);
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
    clearTicketCache() {
      import('../services/ticketsCache')
        .then(({ clearBoxesLocalCache }) => {
          clearBoxesLocalCache();
          console.warn(`${PREFIX} cache local de tickets limpo — F5 ou aguarde refresh de filas`);
        })
        .catch((err) => console.error(`${PREFIX} clearTicketCache falhou`, err));
    },
  };

  if (bannerPrinted) return;
  bannerPrinted = true;

  if (!isDeskDebugEnabled()) {
    console.warn(
      `${PREFIX} console operacional DESLIGADO`,
      '→ Reativar: velodeskDebug.enable() + F5',
    );
    return;
  }

  console.warn(
    `${PREFIX} console operacional ATIVO`,
    'API, tickets, workflow, permissões e ações aparecem aqui.',
    'DevTools → Console → marque Info + Warnings + Errors (não só Errors).',
    'Desativar: velodeskDebug.disable() + F5',
  );
}

export default deskLog;
