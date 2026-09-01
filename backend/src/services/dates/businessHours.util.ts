/**
 * businessHours.util v1.0.0 — tempo decorrido em horas úteis (America/Sao_Paulo)
 * Janela fixa 08:00–21:00, todos os dias (sem exclusão de fim de semana).
 * VERSION: v1.0.0 | DATE: 2026-09-01
 */
import { BRT_OFFSET } from './brDateTime.util';
import { BUSINESS_HOURS_START, BUSINESS_HOURS_END } from '../emailOutbound.constants';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dayKeyOf(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function businessWindowOfDay(dayKey: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dayKey}T${pad2(BUSINESS_HOURS_START)}:00:00${BRT_OFFSET}`),
    end: new Date(`${dayKey}T${pad2(BUSINESS_HOURS_END)}:00:00${BRT_OFFSET}`),
  };
}

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dt);
}

/** Soma, em ms, apenas o tempo dentro da janela útil (08:00–21:00 BRT) entre start e end. */
export function businessMsBetween(start: Date, end: Date): number {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) return 0;

  let total = 0;
  let cursorKey = dayKeyOf(start);
  const endKey = dayKeyOf(end);
  let guard = 0;
  while (guard < 3660) {
    guard += 1;
    const { start: winStart, end: winEnd } = businessWindowOfDay(cursorKey);
    const segStart = winStart > start ? winStart : start;
    const segEnd = winEnd < end ? winEnd : end;
    if (segEnd > segStart) total += segEnd.getTime() - segStart.getTime();
    if (cursorKey === endKey) break;
    cursorKey = nextDayKey(cursorKey);
  }
  return total;
}

/** Mesma coisa que businessMsBetween, mas em horas fracionárias. */
export function businessHoursBetween(start: Date, end: Date): number {
  return businessMsBetween(start, end) / (60 * 60 * 1000);
}
