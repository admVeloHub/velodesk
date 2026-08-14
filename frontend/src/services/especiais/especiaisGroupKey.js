/**
 * especiaisGroupKey — critério compartilhado de fila Finalizadas (4 canais)
 */
import { isTicketTerminalStatus } from '../desk/utils';

const CANAL_RESPONDIDA_STATUSES = new Set([
  'respondida',
  'aguard-avaliacao',
  'aguardando-audiencia',
]);

const STATUS_FIELD_BY_CHANNEL = {
  ra: 'statusRa',
  pc: 'statusPc',
  gov: 'statusGov',
  bc: 'statusBc',
};

function readCanalStatus(item, statusField) {
  if (statusField && item[statusField] != null) {
    return String(item[statusField]).trim().toLowerCase();
  }
  return String(
    item.statusRa || item.statusPc || item.statusGov || item.statusBc || item.statusCanal || '',
  ).trim().toLowerCase();
}

/** Canal fechado: aberta false ou status respondida/aguard. */
export function isCanalFechado(item, statusField) {
  if (!item) return false;
  if (item.aberta === false) return true;
  const status = readCanalStatus(item, statusField);
  return CANAL_RESPONDIDA_STATUSES.has(status);
}

/** Demanda finalizada: canal fechado + ticket Desk terminal. */
export function isEspeciaisItemFinalizada(item) {
  if (!item) return false;
  if (item.groupKey === 'finalizadas') return true;
  const ticketStatus = item.ticketStatus || item.statusTicket;
  const deskTerminal = isTicketTerminalStatus({ status: ticketStatus });
  return isCanalFechado(item) && deskTerminal;
}

/** Item operacional (não finalizado). */
export function isOperationalQueueItem(item) {
  return !isEspeciaisItemFinalizada(item);
}

/** Filtro da listagem Gestão: finalizadas só com chip ativo. */
export function passesGestaoListFilter(item, activeChips = []) {
  const showFinalizadas = activeChips.includes('finalizadas');
  const finalizada = isEspeciaisItemFinalizada(item);
  if (showFinalizadas) return finalizada;
  return !finalizada;
}

/** Reaplica groupKey/aberta a partir dos campos persistidos. */
export function normalizeEspeciaisItemGroup(item, opts = {}) {
  if (!item) return item;
  const ticketStatus = item.ticketStatus || item.statusTicket || '';
  const groupKey = resolveEspeciaisGroupKey(
    { ...item, ticketStatus },
    { ...opts, ticketStatus },
  );
  const aberta = groupKey === 'finalizadas' || groupKey === 'respondidas'
    ? false
    : item.aberta !== false;
  return { ...item, ticketStatus, groupKey, aberta };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isVencendoHoje(item, prazoField = 'prazoRa') {
  const prazo = item[prazoField] || item.prazoLegal || item.prazoPc || item.prazoGov || item.prazoBc;
  if (!prazo || item.aberta === false) return false;
  const d = new Date(prazo);
  return isSameDay(d, new Date()) && item.aberta !== false;
}

function isNaoRespondida(item, naoRespondidaStatus, statusField) {
  const status = readCanalStatus(item, statusField);
  if (status === naoRespondidaStatus || item.groupKey === 'nao-respondidas') return true;
  return false;
}

/**
 * Resolve groupKey exclusivo para filas CRM / chips.
 * @param {object} item
 * @param {{ ticketStatus?: string, statusField?: string, naoRespondidaStatus?: string, prazoField?: string }} opts
 */
export function resolveEspeciaisGroupKey(item, opts = {}) {
  const {
    ticketStatus = item.ticketStatus || item.statusTicket,
    statusField,
    naoRespondidaStatus = 'nao-respondida',
    prazoField,
  } = opts;

  const enriched = { ...item, ticketStatus: ticketStatus || item.ticketStatus };
  if (isEspeciaisItemFinalizada(enriched)) {
    return 'finalizadas';
  }

  if (item.groupKey === 'vencendo-hoje' || isVencendoHoje(item, prazoField)) {
    return 'vencendo-hoje';
  }

  if (isCanalFechado(item, statusField)) {
    return 'respondidas';
  }

  if (isNaoRespondida(item, naoRespondidaStatus, statusField)) {
    return 'nao-respondidas';
  }

  return item.groupKey || 'nao-respondidas';
}

/** Enriquece item com ticketStatus e groupKey recalculado. */
export function applyTicketStatusToEspeciaisItem(item, ticket, opts = {}) {
  if (!item) return item;
  const ticketStatus = String(ticket?.status || item.ticketStatus || '').trim().toLowerCase();
  const groupKey = resolveEspeciaisGroupKey(
    { ...item, ticketStatus },
    { ...opts, ticketStatus },
  );
  const aberta = groupKey === 'finalizadas' || groupKey === 'respondidas'
    ? false
    : item.aberta !== false;

  return {
    ...item,
    ticketStatus,
    groupKey,
    aberta,
  };
}

export { STATUS_FIELD_BY_CHANNEL };
