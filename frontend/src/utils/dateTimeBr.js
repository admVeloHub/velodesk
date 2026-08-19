/**
 * dateTimeBr v1.0.1 — year:false omitido corretamente (evita RangeError no Intl)
 * VERSION: v1.0.1 | DATE: 2026-08-19
 */
export const TZ_BR = 'America/Sao_Paulo';
export const BRT_OFFSET = '-03:00';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Converte valor da API (ISO UTC, Date ou string) em Date válida. */
export function parseApiInstant(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T12:00:00${BRT_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = raw.replace(' ', 'T');
  if (/[zZ]$/.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized) || /[+-]\d{4}$/.test(normalized)) {
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${normalized}${BRT_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateBr(value, options = {}) {
  const d = parseApiInstant(value);
  if (!d) return '—';
  const { year, ...rest } = options;
  const intlOpts = {
    timeZone: TZ_BR,
    day: '2-digit',
    month: '2-digit',
    ...rest,
  };
  if (year !== false) {
    intlOpts.year = year || 'numeric';
  }
  return d.toLocaleDateString('pt-BR', intlOpts);
}

export function formatTimeBr(value, options = {}) {
  const d = parseApiInstant(value);
  if (!d) return '—';
  const {
    year: _y,
    month: _m,
    day: _d,
    weekday: _w,
    ...timeOpts
  } = options;
  return d.toLocaleTimeString('pt-BR', {
    timeZone: TZ_BR,
    hour: '2-digit',
    minute: '2-digit',
    ...timeOpts,
  });
}

export function formatDateTimeBr(value, options = {}) {
  const d = parseApiInstant(value);
  if (!d) return '—';
  const date = formatDateBr(d, options);
  const time = formatTimeBr(d, options);
  if (date === '—' || time === '—') return '—';
  return `${date} ${time}`;
}

export function formatMsgMetaBr(iso, author) {
  if (!iso) return author || '';
  const d = parseApiInstant(iso);
  if (!d) return author || '';
  const date = formatDateBr(d);
  const time = formatTimeBr(d);
  return `${date} às ${time}${author ? ` · ${author}` : ''}`;
}

export function isSameBrDay(a, b) {
  const da = parseApiInstant(a);
  const db = parseApiInstant(b);
  if (!da || !db) return false;
  const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: TZ_BR });
  return fmt(da) === fmt(db);
}

export function brDayKey(value = new Date()) {
  const d = parseApiInstant(value) || new Date();
  return d.toLocaleDateString('en-CA', { timeZone: TZ_BR });
}
