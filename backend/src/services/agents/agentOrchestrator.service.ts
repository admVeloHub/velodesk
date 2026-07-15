/**
 * agentOrchestrator.service v1.0.2 — tabulação sugerida pelo Agente de Auditoria no Desk
 * VERSION: v1.0.2 | DATE: 2026-07-15
 */
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { env } from '../../config/env';
import { appendMessage, currentStatus } from '../chamado.mapper';
import { notifyAgentReplyAsync } from '../emailNotification.service';
import type {
  AtendimentoInput,
  AtendimentoResult,
  AuditModo,
  AuditoriaResult,
  PipelineInput,
  PipelineResult,
  RevisaoOrigem,
  TabulacaoFonte,
  TicketAiTabulationResult,
} from './agentTypes';
import { buildTabulationDisplay } from './agentTabulation.util';
import { composeAtendimento, reviseAtendimento } from './atendimentoAgent.service';
import { validateAuditoria } from './auditoriaAgent.service';
import { saveAgentFeedback } from './agentFeedback.service';
import { evaluateAutonomy } from './autonomyRules.service';
import { executeGestaoHandoff } from './gestaoChamadosHandoff.service';

function resolveDeskTabulacao(
  audit: AuditoriaResult,
  fallbackTab: TicketAiTabulationResult,
  fallbackDisplay?: string,
): { tabulacao: TicketAiTabulationResult; tabulacaoDisplay: string; tabulacaoFonte: TabulacaoFonte } {
  if (audit.tabulacaoSugerida) {
    return {
      tabulacao: audit.tabulacaoSugerida,
      tabulacaoDisplay: audit.tabulacaoDisplay || buildTabulationDisplay(audit.tabulacaoSugerida),
      tabulacaoFonte: 'auditoria',
    };
  }
  return {
    tabulacao: fallbackTab,
    tabulacaoDisplay: fallbackDisplay || buildTabulationDisplay(fallbackTab),
    tabulacaoFonte: 'atendimento',
  };
}

function auditModoFromPipeline(modo: PipelineInput['pipelineModo']): AuditModo {
  return modo === 'desk' ? 'desk_sugestao' : 'auto_envio';
}

function buildClientContext(input: PipelineInput): string {
  if (input.contextSource === 'internal') return input.internalNote || '';
  return (input.messages || []).map((m) => m.text).join('\n');
}

function countThreadMessages(chamado?: IChamadoN1 | null): number {
  if (!chamado?.registro?.length) return 1;
  return chamado.registro.filter((r) => String(r.mensagemPublica || '').trim()).length || 1;
}

async function persistAgentSuggestion(
  chamado: IChamadoN1,
  result: PipelineResult,
): Promise<void> {
  const lastReg = chamado.registro?.[chamado.registro.length - 1];
  if (lastReg) {
    lastReg.metadados = {
      ...(lastReg.metadados || {}),
      agentSuggestion: {
        respostaSugerida: result.respostaSugerida,
        tabulacao: result.tabulacao,
        auditScore: result.auditScore,
        auditDecisao: result.auditDecisao,
        at: new Date().toISOString(),
      },
    };
    await chamado.save();
  }
}

async function sendAutonomousReply(
  chamado: IChamadoN1,
  messageText: string,
): Promise<void> {
  const registroIndex = chamado.registro?.length || 0;
  appendMessage(chamado, messageText, false, 'Agente IA', [], {
    agentAutonomousSend: true,
    agentRun: { at: new Date().toISOString() },
  });

  const status = currentStatus(chamado);
  if (status === 'novo') {
    chamado.registro.push({
      data: new Date(),
      origin: 'agente',
      autor: 'Agente IA',
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [{ status: 'em-andamento' }],
      metadados: {},
      status: 'em-andamento',
    });
  }

  await chamado.save();
  await notifyAgentReplyAsync(chamado, messageText, undefined, registroIndex);
}

export async function runAgentPipeline(input: PipelineInput): Promise<PipelineResult> {
  const auditModo = auditModoFromPipeline(input.pipelineModo);
  const maxRevisions = env.agentRevisionMaxAttempts;
  let revisoesRealizadas = 0;

  let chamado: IChamadoN1 | null = null;
  if (input.ticketId) {
    chamado = await ChamadoN1.findById(input.ticketId);
  }

  let atendimento: AtendimentoResult = await composeAtendimento(input);
  if (!atendimento.success || !atendimento.respostaSugerida || !atendimento.tabulacao) {
    return {
      success: false,
      error: atendimento.error || 'Falha no Agente de Atendimento',
      source: 'agent_pipeline',
    };
  }

  let respostaAtual = atendimento.respostaSugerida;
  let tabulacaoAtual = atendimento.tabulacao;

  let audit = await validateAuditoria({
    modo: auditModo,
    protocolo: input.protocolo,
    canal: input.canal,
    status: input.status || (chamado ? currentStatus(chamado) : 'novo'),
    contextSource: input.contextSource,
    messages: input.messages,
    internalNote: input.internalNote,
    respostaSugerida: respostaAtual,
    tabulacao: tabulacaoAtual,
    confidence: atendimento.confidence,
  });

  if (!audit.success) {
    return { success: false, error: audit.error, source: 'agent_pipeline' };
  }

  while (audit.requerRevisaoAgente1 && revisoesRealizadas < maxRevisions) {
    revisoesRealizadas += 1;
    const origem: RevisaoOrigem = 'automatica_baixo_compliance';

    const revised = await reviseAtendimento({
      ...input,
      respostaAnterior: respostaAtual,
      tabulacaoAnterior: tabulacaoAtual,
      violacoes: audit.violacoes,
      recomendacoes: audit.recomendacoes,
      origemRevisao: origem,
      auditScore: audit.score,
    });

    await saveAgentFeedback({
      ticketId: input.ticketId,
      protocolo: input.protocolo,
      agentOrigem: 'atendimento',
      tipoEvento: 'revisao_automatica',
      scoreAntes: audit.score,
      violacoes: audit.violacoes,
      respostaAntes: respostaAtual,
      respostaDepois: revised.respostaSugerida,
      tabulacao: revised.tabulacao || tabulacaoAtual,
    });

    if (!revised.success || !revised.respostaSugerida || !revised.tabulacao) {
      break;
    }

    atendimento = revised;
    respostaAtual = revised.respostaSugerida;
    tabulacaoAtual = revised.tabulacao;
    audit = await validateAuditoria({
      modo: auditModo,
      protocolo: input.protocolo,
      canal: input.canal,
      status: input.status,
      contextSource: input.contextSource,
      messages: input.messages,
      internalNote: input.internalNote,
      respostaSugerida: respostaAtual,
      tabulacao: tabulacaoAtual,
      confidence: atendimento.confidence,
    });

    if (!audit.success) break;
  }

  if (audit.notificarAgente3 && input.ticketId && input.protocolo) {
    const tabHandoff = resolveDeskTabulacao(audit, tabulacaoAtual, atendimento.tabulacaoDisplay);
    await executeGestaoHandoff({
      ticketId: input.ticketId,
      protocolo: input.protocolo,
      nivelCriticidade: audit.nivelCriticidade || 'alta',
      palavrasCriticas: audit.palavrasCriticasDetectadas,
      categoriaAtendimento: audit.categoriaAtendimento,
      origem: 'agente_auditoria',
      auditScore: audit.score,
      produto: tabHandoff.tabulacao.produto,
      motivo: tabHandoff.tabulacao.motivo,
    });
  }

  const deskTab = resolveDeskTabulacao(audit, tabulacaoAtual, atendimento.tabulacaoDisplay);

  const pipelineResult: PipelineResult = {
    success: true,
    respostaSugerida: respostaAtual,
    tabulacao: deskTab.tabulacao,
    tabulacaoDisplay: deskTab.tabulacaoDisplay,
    tabulacaoFonte: deskTab.tabulacaoFonte,
    confidence: atendimento.confidence,
    auditScore: audit.score,
    auditAprovado: audit.aprovado,
    auditDecisao: audit.decisao,
    auditComplete: true,
    nivelCriticidade: audit.nivelCriticidade,
    revisoesRealizadas,
    model: atendimento.model,
    source: 'agent_pipeline',
  };

  const canTryAutonomous = input.pipelineModo !== 'desk'
    && audit.decisao === 'aprovar_auto'
    && audit.aprovado
    && atendimento.confidence !== 'baixa';

  if (canTryAutonomous && chamado) {
    const autonomy = await evaluateAutonomy({
      tabulacao: tabulacaoAtual,
      canal: input.canal,
      threadMessageCount: countThreadMessages(chamado),
      auditScore: audit.score || 0,
      clientContext: buildClientContext(input),
      responseText: respostaAtual,
    });

    if (autonomy.allowed) {
      await sendAutonomousReply(chamado, respostaAtual);
      await saveAgentFeedback({
        ticketId: input.ticketId,
        protocolo: input.protocolo,
        agentOrigem: 'auditoria',
        tipoEvento: 'envio_autonomo',
        scoreAntes: audit.score,
        respostaDepois: respostaAtual,
        tabulacao: tabulacaoAtual,
      });
      pipelineResult.envioAutonomo = true;
      return pipelineResult;
    }
  }

  if (chamado && input.pipelineModo !== 'desk') {
    await persistAgentSuggestion(chamado, pipelineResult);
  }

  return pipelineResult;
}

export async function runRevisarSugestao(params: {
  input: AtendimentoInput;
  respostaAtual: string;
  tabulacaoAtual: AtendimentoResult['tabulacao'];
  auditScore?: number;
  origemRevisao: RevisaoOrigem;
  inputOperador?: string;
  violacoes?: string[];
  recomendacoes?: string[];
}): Promise<PipelineResult> {
  if (!params.tabulacaoAtual) {
    return { success: false, error: 'Tabulação atual obrigatória' };
  }

  const revised = await reviseAtendimento({
    ...params.input,
    respostaAnterior: params.respostaAtual,
    tabulacaoAnterior: params.tabulacaoAtual,
    origemRevisao: params.origemRevisao,
    inputOperador: params.inputOperador,
    violacoes: params.violacoes,
    recomendacoes: params.recomendacoes,
    auditScore: params.auditScore,
  });

  if (!revised.success || !revised.respostaSugerida || !revised.tabulacao) {
    return { success: false, error: revised.error || 'Falha na revisão' };
  }

  const audit = await validateAuditoria({
    modo: 'desk_sugestao',
    protocolo: params.input.protocolo,
    canal: params.input.canal,
    contextSource: params.input.contextSource,
    messages: params.input.messages,
    internalNote: params.input.internalNote,
    respostaSugerida: revised.respostaSugerida,
    tabulacao: revised.tabulacao,
    confidence: revised.confidence,
  });

  await saveAgentFeedback({
    ticketId: params.input.ticketId,
    protocolo: params.input.protocolo,
    agentOrigem: 'atendimento',
    tipoEvento: params.origemRevisao === 'solicitada_operador' ? 'revisao_solicitada' : 'revisao_automatica',
    scoreAntes: params.auditScore,
    scoreDepois: audit.score,
    violacoes: params.violacoes,
    inputOperador: params.inputOperador,
    respostaAntes: params.respostaAtual,
    respostaDepois: revised.respostaSugerida,
    tabulacao: revised.tabulacao,
  });

  const deskTab = resolveDeskTabulacao(audit, revised.tabulacao, revised.tabulacaoDisplay);

  return {
    success: true,
    respostaSugerida: revised.respostaSugerida,
    tabulacao: deskTab.tabulacao,
    tabulacaoDisplay: deskTab.tabulacaoDisplay,
    tabulacaoFonte: deskTab.tabulacaoFonte,
    confidence: revised.confidence,
    auditScore: audit.score,
    auditAprovado: audit.aprovado,
    auditDecisao: audit.decisao,
    auditComplete: audit.success,
    model: revised.model,
    source: 'agent_revisar_sugestao',
  };
}
