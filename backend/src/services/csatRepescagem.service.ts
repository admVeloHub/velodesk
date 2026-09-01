/**
 * csatRepescagem.service v1.1.0 — prazo configurável no e-mail (aba Emails de Saída),
 * default 48h após CSAT sem resposta, contadas em horas úteis (08:00-21:00, America/Sao_Paulo)
 * VERSION: v1.1.0 | DATE: 2026-09-01
 */
import { ChamadoN1 } from '../models/ChamadoN1';
import { getEmailConteudoByNome } from './emailConteudo.service';
import { businessMsBetween } from './dates/businessHours.util';
import { sendCsatRepescagemEmailAsync } from './csatEmail.service';

export interface CsatRepescagemResult {
  scanned: number;
  sent: number;
  errors: number;
}

const CSAT_REPESCAGEM_TEMPLATE_NOME = 'Repescagem da satisfação';
const CSAT_REPESCAGEM_DEFAULT_PRAZO_HORAS = 48;

/**
 * Envia repescagem para tickets com CSAT enviado, sem resposta e sem repescagem
 * anterior, cujo prazo (horas úteis desde `csat.enviadoEm`) configurado no próprio
 * e-mail (template "Repescagem da satisfação") já se esgotou. Se o e-mail estiver
 * inativo, não dispara.
 */
export async function sendCsatRepescagemPastWindow(
  now = new Date(),
): Promise<CsatRepescagemResult> {
  const doc = await getEmailConteudoByNome(CSAT_REPESCAGEM_TEMPLATE_NOME);
  if (!doc) return { scanned: 0, sent: 0, errors: 0 };

  const criterio = (doc.gatilho?.criterios || []).find((item) => item.tipo === 'gatilho_interno');
  const prazoTipo = criterio?.prazoTipo === 'imediato' ? 'imediato' : 'horas';
  const prazoHoras = prazoTipo === 'horas'
    ? (Number(criterio?.prazoHoras) > 0 ? Number(criterio?.prazoHoras) : CSAT_REPESCAGEM_DEFAULT_PRAZO_HORAS)
    : 0;
  const prazoMs = prazoHoras * 60 * 60 * 1000;

  const candidates = await ChamadoN1.find({
    'csat.enviado': true,
    'csat.respondido': false,
    'csat.repescagemEnviada': false,
  }).select('_id chamadoProtocolo cliente registro csat tabulacao');

  let sent = 0;
  let errors = 0;

  for (const chamado of candidates) {
    try {
      const enviadoEm = chamado.csat?.enviadoEm ? new Date(chamado.csat.enviadoEm) : null;
      if (!enviadoEm || Number.isNaN(enviadoEm.getTime())) continue;
      if (prazoMs > 0 && businessMsBetween(enviadoEm, now) < prazoMs) continue;

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
