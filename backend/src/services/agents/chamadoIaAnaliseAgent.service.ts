/**
 * chamadoIaAnaliseAgent.service v1.0.0 — ciclo periódico de análise de IA do texto do cliente
 * VERSION: v1.0.0 | DATE: 2026-07-23
 */
import { runChamadoIaAnaliseCycle } from '../chamadoIaAnalise.service';
import { mapOpenAiErrorMessage } from './openaiAgent.util';

export async function runChamadoIaAnaliseAgentCycle(): Promise<{
  success: boolean;
  candidatos?: number;
  classificados?: number;
  error?: string;
}> {
  try {
    const { candidatos, classificados } = await runChamadoIaAnaliseCycle();
    if (candidatos > 0) {
      console.info('[agent-chamado-ia-analise] ciclo concluído', { candidatos, classificados });
    }
    return { success: true, candidatos, classificados };
  } catch (err) {
    console.error('[agent-chamado-ia-analise]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}
