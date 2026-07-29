/**
 * closeResolvedTickets.service v1.0.1 — resolvido → fechado após janela configurável
 * VERSION: v1.0.1 | DATE: 2026-07-29
 */
import { ChamadoN1 } from '../models/ChamadoN1';
import { env } from '../config/env';
import { appendStatusTransition } from './chamado.mapper';

export interface CloseResolvedResult {
  scanned: number;
  closed: number;
  errors: number;
}

/** Último registro.status exatamente `resolvido` (não inclui fechado/cancelado da fila). */
function lastStatusExactResolvidoFilter() {
  return {
    $expr: {
      $eq: [{ $arrayElemAt: ['$registro.status', -1] }, 'resolvido'],
    },
  };
}

/**
 * Fecha tickets cujo último status é `resolvido` e a data desse registro
 * é anterior a `now - resolvedCloseAfterMs` (default 48h).
 */
export async function closeResolvedTicketsPastWindow(
  now = new Date(),
): Promise<CloseResolvedResult> {
  const windowMs = Math.max(60_000, env.resolvedCloseAfterMs);
  const cutoff = new Date(now.getTime() - windowMs);

  const candidates = await ChamadoN1.find(lastStatusExactResolvidoFilter()).select(
    '_id chamadoProtocolo registro',
  );

  let closed = 0;
  let errors = 0;

  for (const chamado of candidates) {
    try {
      const registros = chamado.registro ?? [];
      const last = registros[registros.length - 1];
      if (!last || String(last.status || '').toLowerCase() !== 'resolvido') continue;

      const resolvedAt = last.data ? new Date(last.data) : null;
      if (!resolvedAt || Number.isNaN(resolvedAt.getTime())) continue;
      if (resolvedAt.getTime() > cutoff.getTime()) continue;

      appendStatusTransition(chamado, 'fechado', {
        autor: 'sistema',
        anotacaoInterna: 'Fechamento automático após 48h em Resolvido.',
        metadados: {
          source: 'close-resolved-job',
          resolvedAt: resolvedAt.toISOString(),
          closedAt: now.toISOString(),
        },
      });
      await chamado.save();
      closed += 1;
    } catch (err) {
      errors += 1;
      console.warn(
        '[close-resolved] falha ao fechar',
        chamado.chamadoProtocolo || chamado._id?.toString(),
        (err as Error).message,
      );
    }
  }

  return { scanned: candidates.length, closed, errors };
}
