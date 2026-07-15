/**
 * auditoriaAgent.service v1.1.0 — tabulação sugerida pelo Agente de Auditoria
 * VERSION: v1.1.0 | DATE: 2026-07-15
 */
import { env } from '../../config/env';
import type {
  AuditDecisao,
  AuditoriaInput,
  AuditoriaResult,
  NivelCriticidade,
  TicketAiTabulationResult,
} from './agentTypes';
import { getAuditoriaPersona } from './personas/auditoriaPersona';
import {
  AUDITORIA_JSON_SCHEMA,
  buildAuditoriaUserBlock,
  buildTabulationCatalog,
  buildTabulationDisplay,
  loadTabulationConfig,
  validateTabulationResult,
} from './agentTabulation.util';
import {
  createOpenAiClient,
  extractOutputText,
  getAuditoriaVectorStoreIds,
  isAgentsConfigured,
  mapOpenAiErrorMessage,
  parseAiJson,
  trimStr,
} from './openaiAgent.util';
import { detectCriticalKeywords } from './criticalKeywords.service';

interface AuditoriaParsed {
  aprovado?: boolean;
  score?: number;
  modo?: string;
  decisao?: AuditDecisao;
  nivelCriticidade?: NivelCriticidade;
  impactoGravidade?: 'alto' | 'medio' | 'baixo';
  categoriaAtendimento?: string;
  palavrasCriticasDetectadas?: string[];
  requerRevisaoAgente1?: boolean;
  notificarAgente3?: boolean;
  violacoes?: string[];
  recomendacoes?: string[];
  criteriosAvaliados?: Array<{ criterio: string; conforme: boolean; observacao?: string }>;
  tabulacaoSugerida?: { tipo?: string; produto?: string; motivo?: string; detalhe?: string };
}

function resolveTabulacaoSugerida(
  raw: AuditoriaParsed['tabulacaoSugerida'],
  config: Awaited<ReturnType<typeof loadTabulationConfig>>,
): TicketAiTabulationResult | undefined {
  if (!raw) return undefined;
  const validated = validateTabulationResult(raw, config);
  if (!validated.tipo && !validated.produto && !validated.motivo) return undefined;
  return validated;
}

function applyPostAuditRules(
  parsed: AuditoriaParsed,
  params: AuditoriaInput,
  precheckKeywords: string[],
  tabulacaoSugerida?: TicketAiTabulationResult,
): AuditoriaResult {
  const modo = params.modo;
  const threshold = modo === 'auto_envio'
    ? env.agentAuditThresholdAuto
    : env.agentAuditThresholdDesk;

  let score = typeof parsed.score === 'number' ? Math.round(parsed.score) : 0;
  score = Math.max(0, Math.min(100, score));

  const llmKeywords = parsed.palavrasCriticasDetectadas || [];
  const allKeywords = [...new Set([...precheckKeywords, ...llmKeywords])];
  const hasCritical = allKeywords.length > 0;

  let decisao: AuditDecisao = parsed.decisao || 'encaminhar_humano';
  let nivelCriticidade: NivelCriticidade = parsed.nivelCriticidade || 'nenhuma';
  let notificarAgente3 = Boolean(parsed.notificarAgente3);
  let requerRevisaoAgente1 = Boolean(parsed.requerRevisaoAgente1);
  let aprovado = Boolean(parsed.aprovado);

  const tabTipo = tabulacaoSugerida?.tipo || params.tabulacao.tipo;

  if (hasCritical) {
    decisao = 'bloquear_critico';
    nivelCriticidade = nivelCriticidade === 'nenhuma' ? 'alta' : nivelCriticidade;
    if (allKeywords.some((k) => ['procon', 'processo', 'fraude', 'ameaça', 'bacen'].includes(k))) {
      nivelCriticidade = 'critica';
    }
    notificarAgente3 = true;
    requerRevisaoAgente1 = false;
    aprovado = false;
  } else if (score < threshold) {
    decisao = 'revisar_agente1';
    requerRevisaoAgente1 = true;
    aprovado = false;
  } else if (modo === 'auto_envio') {
    const categoria = trimStr(parsed.categoriaAtendimento || tabTipo, 64);
    const impacto = parsed.impactoGravidade || 'medio';
    if (categoria === 'Reclamação' || impacto === 'alto') {
      decisao = 'encaminhar_humano';
      aprovado = false;
    } else {
      decisao = 'aprovar_auto';
      aprovado = true;
    }
  } else if (modo === 'desk_sugestao') {
    decisao = 'exibir_sugestao';
    aprovado = score >= threshold;
  }

  return {
    success: true,
    aprovado,
    score,
    modo,
    decisao,
    nivelCriticidade,
    impactoGravidade: parsed.impactoGravidade || 'medio',
    categoriaAtendimento: parsed.categoriaAtendimento || tabTipo,
    palavrasCriticasDetectadas: allKeywords,
    requerRevisaoAgente1,
    notificarAgente3,
    violacoes: parsed.violacoes || [],
    recomendacoes: parsed.recomendacoes || [],
    criteriosAvaliados: parsed.criteriosAvaliados || [],
    tabulacaoSugerida,
    tabulacaoDisplay: tabulacaoSugerida ? buildTabulationDisplay(tabulacaoSugerida) : undefined,
  };
}

export async function validateAuditoria(params: AuditoriaInput): Promise<AuditoriaResult> {
  if (!isAgentsConfigured()) {
    return { success: false, error: 'Agentes não configurados' };
  }

  const contextText = [
    ...(params.messages || []).map((m) => m.text),
    params.internalNote,
    params.respostaSugerida,
    params.ultimaMensagemCliente,
    params.mensagemOperador,
  ].filter(Boolean).join('\n');

  const precheckKeywords = detectCriticalKeywords(
    contextText,
    ...(params.palavrasCriticasPrecheck || []),
  );

  try {
    const config = await loadTabulationConfig();
    const tabulationCatalog = buildTabulationCatalog(config);
    const userBlock = buildAuditoriaUserBlock(
      { ...params, palavrasCriticasPrecheck: precheckKeywords },
      tabulationCatalog,
    );

    const openai = createOpenAiClient();
    const vectorIds = getAuditoriaVectorStoreIds();
    const tools = vectorIds.length
      ? [{ type: 'file_search' as const, vector_store_ids: vectorIds }]
      : undefined;

    const response = await openai.responses.create({
      model: env.openaiModel,
      input: [
        { role: 'system', content: getAuditoriaPersona(params.modo) },
        { role: 'user', content: userBlock },
      ],
      ...(tools ? { tools } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'agent_auditoria',
          schema: AUDITORIA_JSON_SCHEMA,
          strict: true,
        },
      },
    });

    const rawText = extractOutputText(response);
    const parsed = parseAiJson<AuditoriaParsed>(rawText);

    if (!parsed || typeof parsed.score !== 'number') {
      return { success: false, error: 'Resposta de auditoria inválida' };
    }

    const tabulacaoSugerida = resolveTabulacaoSugerida(parsed.tabulacaoSugerida, config);
    const result = applyPostAuditRules(parsed, params, precheckKeywords, tabulacaoSugerida);
    return { ...result, model: response.model || env.openaiModel };
  } catch (err) {
    console.error('[agent-auditoria]', err);
    return { success: false, error: mapOpenAiErrorMessage(err) };
  }
}
