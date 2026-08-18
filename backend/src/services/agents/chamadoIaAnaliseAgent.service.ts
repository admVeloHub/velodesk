/**
 * chamadoIaAnaliseAgent.service v1.2.0 — ciclo periódico de análise IA (tickets + Letícia IA)
 * O batch de telefonia é opt-in (TELEPHONY_IA_BATCH_ENABLED): cada ligação já é classificada
 * na chegada (telephonyInbound). A re-varredura periódica fazia sort pesado em telephony_calls
 * (Sort exceeded memory limit) e ficou desligada por padrão.
 */
import { env } from '../../config/env';
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
    const tickets = await runChamadoIaAnaliseCycle();
    const telephony = env.telephonyIaBatchEnabled
      ? await runTelephonyIaAnaliseCycle()
      : { candidatos: 0, classificados: 0 };

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
