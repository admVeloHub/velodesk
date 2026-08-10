/**
 * chamadoIaAnaliseAgent.service v1.1.0 — ciclo periódico de análise IA (tickets + Letícia IA)
 */
import { runChamadoIaAnaliseCycle } from '../chamadoIaAnalise.service';
import { runTelephonyIaAnaliseCycle } from '../telephonyIaAnalise.service';
import { mapOpenAiErrorMessage } from './openaiAgent.util';

export async function runChamadoIaAnaliseAgentCycle(): Promise<{
  success: boolean;
  candidatos?: number;
  classificados?: number;
  error?: string;
}> {
  try {
    const [tickets, telephony] = await Promise.all([
      runChamadoIaAnaliseCycle(),
      runTelephonyIaAnaliseCycle(),
    ]);
    if (tickets.candidatos > 0 || telephony.candidatos > 0) {
      console.info('[agent-chamado-ia-analise] ciclo concluído', {
        candidatos: tickets.candidatos,
        classificados: tickets.classificados,
        telephonyCandidatos: telephony.candidatos,
        telephonyClassificados: telephony.classificados,
      });
    }
    return {
      success: true,
      candidatos: tickets.candidatos + telephony.candidatos,
      classificados: tickets.classificados + telephony.classificados,
    };
  } catch (err) {
    console.error('[agent-chamado-ia-analise]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}
