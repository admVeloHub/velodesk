/**
 * atendimentoAgent.service v1.0.0 — Agente de Atendimento (compose + revise)
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import { env } from '../../config/env';
import type { AtendimentoInput, AtendimentoResult, RevisaoInput, ConfidenceLevel } from './agentTypes';
import { getAtendimentoPersona } from './personas/atendimentoPersona';
import { getAtendimentoRevisaoPersona } from './personas/atendimentoRevisaoPersona';
import {
  ATENDIMENTO_JSON_SCHEMA,
  buildAtendimentoUserBlock,
  buildTabulationDisplay,
  loadTabulationConfig,
  buildTabulationCatalog,
  validateTabulationResult,
} from './agentTabulation.util';
import {
  createOpenAiClient,
  extractOutputText,
  getAtendimentoVectorStoreIds,
  isAgentsConfigured,
  mapOpenAiErrorMessage,
  parseAiJson,
} from './openaiAgent.util';
import { getFeedbackExamplesForPrompt } from './agentFeedback.service';
import { logAiUsage } from '../aiUsage.service';

interface AtendimentoParsed {
  respostaSugerida?: string;
  tabulacao?: { tipo?: string; produto?: string; motivo?: string; detalhe?: string };
  confidence?: ConfidenceLevel;
  fontesConsultadas?: string[];
}

async function callAtendimentoOpenAi(
  systemPrompt: string,
  userBlock: string,
  vectorStoreIds: string[],
  usageContext: { ticketId?: string; protocolo?: string },
): Promise<{ parsed: AtendimentoParsed | null; model: string }> {
  const openai = createOpenAiClient();
  const tools = vectorStoreIds.length
    ? [{ type: 'file_search' as const, vector_store_ids: vectorStoreIds }]
    : undefined;

  const response = await openai.responses.create({
    model: env.openaiModel,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userBlock },
    ],
    ...(tools ? { tools } : {}),
    text: {
      format: {
        type: 'json_schema',
        name: 'agent_atendimento',
        schema: ATENDIMENTO_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  const model = response.model || env.openaiModel;
  if (response.usage) {
    void logAiUsage({
      provider: 'openai',
      model,
      feature: 'atendimento',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      ticketId: usageContext.ticketId,
      protocolo: usageContext.protocolo,
    });
  }

  const rawText = extractOutputText(response);
  const parsed = parseAiJson<AtendimentoParsed>(rawText);
  return { parsed, model };
}

export async function composeAtendimento(params: AtendimentoInput): Promise<AtendimentoResult> {
  if (!isAgentsConfigured()) {
    return { success: false, error: 'Agentes não configurados' };
  }

  try {
    const config = await loadTabulationConfig();
    const catalog = buildTabulationCatalog(config);
    const feedbackExamples = await getFeedbackExamplesForPrompt(params.produtoHint);

    const userBlock = buildAtendimentoUserBlock(
      { ...params, feedbackExamples },
      catalog,
    );

    const vectorIds = getAtendimentoVectorStoreIds();
    const { parsed, model } = await callAtendimentoOpenAi(
      getAtendimentoPersona(),
      userBlock,
      vectorIds,
      { ticketId: params.ticketId, protocolo: params.protocolo },
    );

    if (!parsed?.respostaSugerida?.trim()) {
      return { success: false, error: 'Resposta da IA inválida ou vazia' };
    }

    const tabulacao = validateTabulationResult(parsed.tabulacao || {}, config);

    return {
      success: true,
      respostaSugerida: parsed.respostaSugerida.trim(),
      tabulacao,
      tabulacaoDisplay: buildTabulationDisplay(tabulacao),
      confidence: parsed.confidence || 'media',
      fontesConsultadas: parsed.fontesConsultadas || ['public', 'pop'],
      model,
    };
  } catch (err) {
    console.error('[agent-atendimento]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}

export async function reviseAtendimento(params: RevisaoInput): Promise<AtendimentoResult> {
  if (!isAgentsConfigured()) {
    return { success: false, error: 'Agentes não configurados' };
  }

  try {
    const config = await loadTabulationConfig();
    const catalog = buildTabulationCatalog(config);
    const feedbackExamples = await getFeedbackExamplesForPrompt(
      params.tabulacaoAnterior.produto || params.produtoHint,
      params.tabulacaoAnterior.motivo,
    );

    const systemPrompt = getAtendimentoRevisaoPersona({
      origemRevisao: params.origemRevisao,
      inputOperador: params.inputOperador,
      violacoes: params.violacoes,
      recomendacoes: params.recomendacoes,
      respostaAnterior: params.respostaAnterior,
    });

    const userBlock = buildAtendimentoUserBlock(
      { ...params, feedbackExamples },
      catalog,
    );

    const vectorIds = getAtendimentoVectorStoreIds();
    const { parsed, model } = await callAtendimentoOpenAi(
      systemPrompt,
      userBlock,
      vectorIds,
      { ticketId: params.ticketId, protocolo: params.protocolo },
    );

    if (!parsed?.respostaSugerida?.trim()) {
      return { success: false, error: 'Revisão da IA inválida ou vazia' };
    }

    const tabulacao = validateTabulationResult(parsed.tabulacao || {}, config);

    return {
      success: true,
      respostaSugerida: parsed.respostaSugerida.trim(),
      tabulacao,
      tabulacaoDisplay: buildTabulationDisplay(tabulacao),
      confidence: parsed.confidence || 'media',
      fontesConsultadas: parsed.fontesConsultadas || ['public', 'pop'],
      model,
    };
  } catch (err) {
    console.error('[agent-atendimento-revise]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}
