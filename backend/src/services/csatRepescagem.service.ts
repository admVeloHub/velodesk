/**
 * csatRepescagem.service v1.0.0 — repescagem única 48h após CSAT sem resposta
 * VERSION: v1.0.0 | DATE: 2026-08-24
 */
import { ChamadoN1 } from '../models/ChamadoN1';
import { env } from '../config/env';
import { sendCsatRepescagemEmailAsync } from './csatEmail.service';

export interface CsatRepescagemResult {
  scanned: number;
  sent: number;
  errors: number;
}

/**
 * Envia repescagem para tickets com CSAT enviado, sem resposta e sem repescagem
 * anterior, cuja data de envio ultrapassou a janela configurável (default 48h).
 */
export async function sendCsatRepescagemPastWindow(
  now = new Date(),
): Promise<CsatRepescagemResult> {
  const windowMs = Math.max(60_000, env.csatRepescagemAfterMs);
  const cutoff = new Date(now.getTime() - windowMs);

  const candidates = await ChamadoN1.find({
    'csat.enviado': true,
    'csat.respondido': false,
    'csat.repescagemEnviada': false,
    'csat.enviadoEm': { $lte: cutoff },
  }).select('_id chamadoProtocolo cliente registro csat tabulacao');

  let sent = 0;
  let errors = 0;

  for (const chamado of candidates) {
    try {
      await sendCsatRepescagemEmailAsync(chamado);
      // Se o subdocumento foi atualizado, o envio teve sucesso
      if (chamado.csat?.repescagemEnviada) {
        sent += 1;
      }
    } catch (err) {
      errors += 1;
      console.warn(
        '[csat-repescagem] falha',
        chamado.chamadoProtocolo || chamado._id?.toString(),
        (err as Error).message,
      );
    }
  }

  return { scanned: candidates.length, sent, errors };
}
