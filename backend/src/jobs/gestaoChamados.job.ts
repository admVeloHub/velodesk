/**
 * gestaoChamados.job v1.1.0 — snapshot horário de tickets ativos para Agente 3
 * VERSION: v1.1.0 | DATE: 2026-07-14
 */
import { env } from '../config/env';
import { isMongoConnected } from '../config/database';
import { runGestaoChamadosCycle } from '../services/agents/gestaoChamadosAgent.service';

let gestaoTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runCycleSafe(): Promise<void> {
  if (running || !env.agentsEnabled || !isMongoConnected()) return;
  running = true;
  try {
    await runGestaoChamadosCycle();
  } catch (err) {
    console.warn('[gestao-chamados-job]', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startGestaoChamadosJob(): void {
  if (!env.agentsEnabled) {
    console.info('[gestao-chamados-job] AGENTS_ENABLED=false — job não iniciado.');
    return;
  }

  if (gestaoTimer) return;

  const intervalMs = Math.max(60_000, env.gestaoSnapshotIntervalMs);
  console.info(`[gestao-chamados-job] iniciado — snapshot horário a cada ${intervalMs}ms`);

  void runCycleSafe();
  gestaoTimer = setInterval(() => {
    void runCycleSafe();
  }, intervalMs);
}

export function stopGestaoChamadosJob(): void {
  if (gestaoTimer) {
    clearInterval(gestaoTimer);
    gestaoTimer = null;
  }
}
