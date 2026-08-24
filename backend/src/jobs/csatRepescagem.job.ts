/**
 * csatRepescagem.job v1.0.0 — repescagem CSAT a cada 1h (backfill na 1ª run)
 * VERSION: v1.0.0 | DATE: 2026-08-24
 */
import { env } from '../config/env';
import { isMongoConnected } from '../config/database';
import { sendCsatRepescagemPastWindow } from '../services/csatRepescagem.service';

let repescagemTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runCycleSafe(): Promise<void> {
  if (running || !isMongoConnected()) return;
  running = true;
  try {
    const result = await sendCsatRepescagemPastWindow();
    if (result.sent > 0 || result.errors > 0) {
      console.info('[csat-repescagem-job]', result);
    }
  } catch (err) {
    console.warn('[csat-repescagem-job]', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startCsatRepescagemJob(): void {
  if (repescagemTimer) return;

  const intervalMs = Math.max(60_000, env.csatRepescagemIntervalMs);
  console.info(
    `[csat-repescagem-job] iniciado — repescagem após ${env.csatRepescagemAfterMs}ms a cada ${intervalMs}ms`,
  );

  // 1ª execução imediata: backfill do backlog elegível
  void runCycleSafe();
  repescagemTimer = setInterval(() => {
    void runCycleSafe();
  }, intervalMs);
}

export function stopCsatRepescagemJob(): void {
  if (repescagemTimer) {
    clearInterval(repescagemTimer);
    repescagemTimer = null;
  }
}
