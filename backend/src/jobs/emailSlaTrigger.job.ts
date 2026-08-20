/**
 * emailSlaTrigger.job v1.0.1 — ciclo de SLA a cada 1 hora
 * VERSION: v1.0.1 | DATE: 2026-08-20
 */
import { ChamadoN1 } from '../models/ChamadoN1';
import { isDeskConfigConnected, isMongoConnected } from '../config/database';
import { evaluateEmailTriggers } from '../services/emailTrigger.service';

const INTERVAL_MS = 60 * 60 * 1000;

let slaTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runCycleSafe(): Promise<void> {
  if (running || !isMongoConnected() || !isDeskConfigConnected()) return;
  running = true;
  try {
    const cursor = ChamadoN1.find({
      $expr: {
        $in: [
          { $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'] },
          ['em-aberto', 'em-andamento'],
        ],
      },
    }).cursor();

    let scanned = 0;
    let sent = 0;
    for await (const chamado of cursor) {
      scanned += 1;
      sent += await evaluateEmailTriggers(chamado, 'sla');
    }
    if (sent > 0) {
      console.info('[email-sla-job]', { scanned, sent });
    }
  } catch (err) {
    console.warn('[email-sla-job]', (err as Error).message);
  } finally {
    running = false;
  }
}

export function startEmailSlaTriggerJob(): void {
  if (slaTimer) return;
  console.info('[email-sla-job] iniciado — intervalo 1h');
  void runCycleSafe();
  slaTimer = setInterval(() => {
    void runCycleSafe();
  }, INTERVAL_MS);
}

export function stopEmailSlaTriggerJob(): void {
  if (slaTimer) {
    clearInterval(slaTimer);
    slaTimer = null;
  }
}
