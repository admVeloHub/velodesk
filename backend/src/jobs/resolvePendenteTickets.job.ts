/**
 * resolvePendenteTickets.job v1.0.0 — varredura a cada hora cheia: pendente≥48h → resolvido
 * VERSION: v1.0.0 | DATE: 2026-08-12
 */
import { isMongoConnected } from '../config/database';
import { resolvePendenteTicketsPastWindow } from '../services/resolvePendenteTickets.service';
import { env } from '../config/env';

const HOUR_MS = 60 * 60 * 1000;

let hourTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runCycleSafe(): Promise<void> {
  if (running || !isMongoConnected()) return;
  running = true;
  try {
    const result = await resolvePendenteTicketsPastWindow();
    if (result.resolved > 0 || result.errors > 0) {
      console.info('[resolve-pendente-job]', result);
    }
  } catch (err) {
    console.warn('[resolve-pendente-job]', (err as Error).message);
  } finally {
    running = false;
  }
}

function msUntilNextHour(): number {
  const now = Date.now();
  const next = Math.ceil(now / HOUR_MS) * HOUR_MS;
  const delay = next - now;
  // Se cair exatamente na hora cheia, agenda a próxima.
  return delay <= 0 ? HOUR_MS : delay;
}

export function startResolvePendenteTicketsJob(): void {
  if (hourTimer || intervalTimer) return;

  console.info(
    `[resolve-pendente-job] iniciado — pendente→resolvido após ${env.pendenteResolveAfterMs}ms, varredura a cada hora cheia`,
  );

  hourTimer = setTimeout(() => {
    hourTimer = null;
    void runCycleSafe();
    intervalTimer = setInterval(() => {
      void runCycleSafe();
    }, HOUR_MS);
  }, msUntilNextHour());
}

export function stopResolvePendenteTicketsJob(): void {
  if (hourTimer) {
    clearTimeout(hourTimer);
    hourTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
