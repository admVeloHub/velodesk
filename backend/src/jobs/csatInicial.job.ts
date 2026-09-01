/**
 * csatInicial.job v1.0.0 — pesquisa de CSAT inicial, decoupled do fechamento automático
 * de tickets. Gatilho (status + prazo) configurado no e-mail "Encerramento mais
 * satisfação" (aba Emails de Saída). Mesma cadência do job de repescagem.
 * VERSION: v1.0.0 | DATE: 2026-09-01
 */
import { env } from '../config/env';
import { isMongoConnected } from '../config/database';
import { runCsatInicialPastWindow } from '../services/csatEmail.service';

let inicialTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runCycleSafe(): Promise<void> {
  if (running || !isMongoConnected()) return;
  running = true;
  try {
    const result = await runCsatInicialPastWindow();
    if (result.sent > 0 || result.errors > 0) {
      console.info('[csat-inicial-job]', result);
    }
  } catch (err) {
    console.warn('[csat-inicial-job]', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startCsatInicialJob(): void {
  if (inicialTimer) return;

  const intervalMs = Math.max(60_000, env.csatRepescagemIntervalMs);
  console.info(`[csat-inicial-job] iniciado — intervalo ${intervalMs}ms`);

  // 1ª execução imediata: backfill do backlog elegível
  void runCycleSafe();
  inicialTimer = setInterval(() => {
    void runCycleSafe();
  }, intervalMs);
}

export function stopCsatInicialJob(): void {
  if (inicialTimer) {
    clearInterval(inicialTimer);
    inicialTimer = null;
  }
}
