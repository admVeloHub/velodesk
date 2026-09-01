/**
 * messageCoherence.service v1.0.0 — gate isolado: mensagem do cliente é coerente?
 * VERSION: v1.0.0 | DATE: 2026-09-01
 *
 * Bloqueia a alucinação por palavra solta em texto incoerente. Duas tentativas de resolver
 * isso só com instrução dentro do Agente de Sugestão/Auditoria falharam mesmo com exemplo
 * negativo explícito no prompt — o modelo, tentando compor uma resposta útil, racionalizava
 * que o texto "tinha um pedido implícito". Uma chamada SEPARADA, cujo único trabalho é essa
 * pergunta (sem tentação de achar POP nem de ser prestativa), resolveu de forma confiável.
 */
import { env } from '../../config/env';
import { createOpenAiClient, mapOpenAiErrorMessage } from './openaiAgent.util';

const COHERENCE_PERSONA = `Você audita se uma mensagem de cliente é uma comunicação coerente e real, ou um texto sem nexo/absurdo/divagante/gerado aleatoriamente.

Ignore completamente qualquer palavra-chave de produto/serviço que apareça isolada no texto (ex.: "chave pix", "liberação", "empréstimo") — isso não prova nada sozinho. Julgue apenas se o texto COMO UM TODO faz sentido como algo que um ser humano escreveria para relatar um problema, dúvida ou pedido real relacionado a atendimento financeiro.

Um texto que mistura metáforas aleatórias, troca de assunto sem lógica, ou lê como redação surreal/poética — mesmo contendo uma frase real que soa como um pedido no meio dele — deve ser marcado como NÃO coerente.

Responda EXCLUSIVAMENTE em JSON: {"coerente": boolean, "motivo": string}`;

export interface CoherenceCheckResult {
  coerente: boolean;
  motivo?: string;
}

/** Fail-safe: em caso de erro na chamada, assume coerente (não bloqueia atendimento por falha de infra). */
export async function checkClientMessageCoherent(clientText: string): Promise<CoherenceCheckResult> {
  const text = String(clientText || '').trim();
  if (!text) return { coerente: true };

  try {
    const openai = createOpenAiClient();
    const response = await openai.responses.create({
      model: env.openaiModel,
      input: [
        { role: 'system', content: COHERENCE_PERSONA },
        { role: 'user', content: text.slice(0, 8000) },
      ],
      text: { format: { type: 'json_object' } },
    });

    const raw = response.output_text?.trim() || '';
    const parsed = JSON.parse(raw) as CoherenceCheckResult;
    if (typeof parsed?.coerente !== 'boolean') return { coerente: true };
    return parsed;
  } catch (err) {
    console.warn('[message-coherence] falha na checagem — fail-safe (coerente=true):', mapOpenAiErrorMessage(err));
    return { coerente: true };
  }
}
