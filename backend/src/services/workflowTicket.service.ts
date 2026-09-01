/** workflowTicket.service v1.11.0 — reprovação grava metadados.workflowDecision + notifica responsável */
import { isAutomaticaStep, resolveAutomaticaConfig } from './workflowAutomatica.util';
import { Types } from 'mongoose';
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1, IChamadoWorkflow, IRegistro } from '../models/ChamadoN1';
import type { IWorkflowDefinicao, IWorkflowPassoEnvelope } from '../models/WorkflowDefinicao';
import {
  appendRegistroEntry,
  appendStatusTransition,
  currentStatus,
  isClientIdentifiedOnChamado,
  MERGE_TERMINAL_STATUSES,
  normalizeStatusValue,
  readTabulacaoSnapshot,
} from './chamado.mapper';
import { wrapComposerOpening } from './clientMessageEnvelope.service';
import { notifyAgentReplyAsync } from './emailNotification.service';
import { getActiveWorkflows, getWorkflowById, getWorkflowBySlug, resolveWorkflowForTicket } from './workflowDefinicao.service';
import { getActiveGrupos } from './grupoResponsabilidade.service';
import {
  buildTabulationFieldsFromChamado,
  buildTabulationFieldsFromTicket,
  buildWorkflowTicketContextFromChamado,
  evaluateGatilhoCriterios,
  resolveAtribuidoForPasso,
} from './workflowMatcher.service';
import {
  canApproveWorkflow,
  canUserActOnWorkflowStep,
  matchesWorkflowDefinitionTeam,
  resolveUserPermissions,
  resolveWorkflowTeamQueueForUser,
  ticketMatchesWorkflowTeamAsync,
} from './permission.service';
import { executeSistemaStep, isDevolutivaPasso } from './workflowSistemaExecutor.service';
import { notifyWorkflowRejectToResponsavel } from './workflowNotificacao.service';
import { buildLateralWorkflowDto } from './workflowDto.util';
import {
  applyRequisicaoToChamado,
  buildRequisicaoSnapshot,
  WorkflowRequisicaoError,
} from './workflowRequisicao.service';
import type { IChamadoWorkflowRequisicao } from '../config/workflowRequisicaoDefaults';
import { normalizeFuncao } from '../utils/normalizeFuncao';

export class WorkflowAdvanceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function sortPassos(definicao: IWorkflowDefinicao): IWorkflowPassoEnvelope[] {
  return [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function passoAtIndex(definicao: IWorkflowDefinicao, step: number): IWorkflowPassoEnvelope | null {
  const passos = sortPassos(definicao);
  return passos[step] ?? null;
}

/**
 * Resolve a etapa de destino configurada para uma decisão (approve/reject) na
 * etapa de aprovação atual (acao.rotas[].proximoPassoId). Etapa de reprovação
 * é obrigatória na configuração do workflow (ver workflowDefinicao.service) —
 * se ainda assim vier ausente/inválida (dado legado), retorna null e quem
 * chamou decide o que fazer.
 */
function resolveRotaProximoPassoIndex(
  definicao: IWorkflowDefinicao,
  passo: IWorkflowPassoEnvelope | null,
  variavel: 'approve' | 'reject',
): number | null {
  const rota = (passo?.passo?.acao?.rotas || []).find((r) => r.variavel === variavel);
  if (!rota?.proximoPassoId) return null;
  const passos = sortPassos(definicao);
  const idx = passos.findIndex((p) => String(p._id) === String(rota.proximoPassoId));
  return idx >= 0 ? idx : null;
}

function resolveTeamApprovalStepIndex(definicao: IWorkflowDefinicao, teamSlug: string): number | null {
  const team = normalizeFuncao(teamSlug);
  const passos = sortPassos(definicao);
  const idx = passos.findIndex((p) => {
    if (p.passo?.acao?.tipo !== 'aprovacao') return false;
    const grupo = normalizeFuncao(p.passo?.atribuicao?.grupoSlug || '');
    const funcao = normalizeFuncao(p.passo?.atribuicao?.funcaoSlug || '');
    return grupo === team || funcao === team;
  });
  return idx >= 0 ? idx : null;
}

export function resolveProdutosApprovalStepIndex(definicao: IWorkflowDefinicao): number | null {
  return resolveTeamApprovalStepIndex(definicao, 'produtos');
}

function ensureWorkflowState(chamado: IChamadoN1): IChamadoWorkflow {
  if (!chamado.workflow) {
    chamado.workflow = {
      active: false,
      workflowStatus: null,
      workflowId: null,
      step: 0,
      passoId: null,
      startedAt: null,
      completedAt: null,
      pendingDecision: null,
    };
  }
  return chamado.workflow;
}

function applyAtribuidoForPasso(chamado: IChamadoN1, passo: IWorkflowPassoEnvelope): void {
  const fields = buildTabulationFieldsFromChamado(chamado);
  let atribuido = resolveAtribuidoForPasso(passo.passo?.atribuicao || { tipo: 'funcao', funcaoSlug: 'atendimento', colaborador: '' }, fields);
  if (!atribuido) return;
  if (atribuido.startsWith('funcao:')) {
    atribuido = `funcao:${normalizeFuncao(atribuido.slice(7))}`;
  }
  const tab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  chamado.tabulacao = [{ ...tab, atribuido }];
}

const TIPO_SOLICITACAO_LABELS: Record<string, string> = {
  'alteracao-dados-cadastrais': 'alteração de dados cadastrais',
};

function buildProdutosConclusaoClientMessage(chamado: IChamadoN1): string {
  const nome = String(chamado.chamadoTitulo || '').trim().split(/\s+/)[0] || 'cliente';
  const solic = chamado.workflow?.requisicao?.solicitacaoProdutos as Record<string, unknown> | undefined;
  const tipoRaw = String(solic?.tipoSolicitacao || '').trim();
  const tab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  let tipo = TIPO_SOLICITACAO_LABELS[tipoRaw] || 'solicitação';
  if (!tipoRaw && tab?.motivo && tab?.produto) {
    tipo = `${tab.motivo} · ${tab.produto}`;
  } else if (!tipoRaw && tab?.motivo) {
    tipo = String(tab.motivo);
  }
  return `Olá, ${nome}! Sua solicitação de ${tipo} foi analisada e concluída pelo time de Produtos. Estamos à disposição caso precise de algo mais.`;
}

async function appendProdutosConclusaoPublicMessage(chamado: IChamadoN1, autor: string): Promise<void> {
  const nucleo = buildProdutosConclusaoClientMessage(chamado);
  const composerText = wrapComposerOpening({ nucleo, agentName: autor });
  const result = appendRegistroEntry(chamado, {
    mensagemPublica: composerText,
    sender: 'me',
    autor,
    metadados: {
      workflowProdutosConclusao: true,
      at: new Date().toISOString(),
    },
  });
  // appendRegistroEntry só grava no chamado em memória — sem isto o "Retorno ao Cliente"
  // automático do workflow de Produtos nunca chegava ao e-mail do cliente, só ficava
  // registrado como mensagem pública no ticket (quem chama salva o chamado depois,
  // persistindo o carimbo de emailOutboundMessageId que notifyAgentReplyAsync grava aqui).
  await notifyAgentReplyAsync(chamado, composerText, undefined, result.public?.registroIndex);
}

function markTicketEmAndamentoAfterReject(chamado: IChamadoN1, autor: string): void {
  const status = normalizeStatusValue(currentStatus(chamado));
  if ((MERGE_TERMINAL_STATUSES as readonly string[]).includes(status)) return;
  if (status === 'em-andamento') return;
  appendStatusTransition(chamado, 'em-andamento', {
    autor,
    anotacaoInterna: 'Workflow reprovado — aguardando retorno manual ao cliente pelo responsável.',
    metadados: { workflowReject: true },
  });
}

function appendWorkflowRegistro(
  chamado: IChamadoN1,
  payload: {
    autor: string;
    alteracoes?: unknown[];
    metadados?: Record<string, unknown>;
    anotacaoInterna?: string;
  },
): void {
  const status = currentStatus(chamado);
  const entry: IRegistro = {
    data: new Date(),
    origin: 'agente',
    autor: payload.autor,
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: payload.anotacaoInterna || '',
    anexosAnotacaoInterna: [],
    alteracoes: payload.alteracoes || [],
    metadados: payload.metadados || {},
    status,
  };
  chamado.registro.push(entry);
}

/**
 * Transição única para resolvido no instante em que o workflow conclui.
 * Não reexecuta em leituras/sync — só no bloco de conclusão de advanceToStep.
 * Respostas posteriores do cliente reabrem via resolveInboundClientReplyStatus.
 */
function resolveTicketOnWorkflowFinished(chamado: IChamadoN1, autor: string): void {
  const status = normalizeStatusValue(currentStatus(chamado));
  if ((MERGE_TERMINAL_STATUSES as readonly string[]).includes(status)) {
    return;
  }
  appendStatusTransition(chamado, 'resolvido', {
    autor,
    anotacaoInterna: 'Ticket resolvido automaticamente ao concluir o workflow.',
    metadados: {
      workflowFinishedResolve: true,
      trigger: 'workflow-finished',
    },
  });
}

async function runSistemaIfNeeded(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
  step: number,
): Promise<{ autoAdvanced: boolean }> {
  const passo = passoAtIndex(definicao, step);
  if (!passo || !isAutomaticaStep(passo.passo)) {
    return { autoAdvanced: false };
  }

  const result = await executeSistemaStep(chamado, definicao, step, passo);
  if (result.autoAdvance && result.ok) {
    return advanceToStep(chamado, definicao, step + 1, 'Sistema', { trigger: 'sistema-auto' });
  }
  return { autoAdvanced: false };
}

async function advanceToStep(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
  nextStep: number,
  autor: string,
  options: {
    trigger?: string;
    skipped?: boolean;
    decision?: string;
    /** Reprovação: não dispara resposta automática ao cliente na devolutiva. */
    skipSistema?: boolean;
  } = {},
): Promise<{ autoAdvanced: boolean }> {
  const wf = ensureWorkflowState(chamado);
  const passos = sortPassos(definicao);

  if (nextStep >= passos.length) {
    wf.step = passos.length > 0 ? passos.length - 1 : 0;
    wf.passoId = passos[wf.step]?._id as Types.ObjectId || null;
    wf.completedAt = new Date();
    wf.active = false;
    wf.workflowStatus = 'finished';
    wf.pendingDecision = null;
    appendWorkflowRegistro(chamado, {
      autor,
      anotacaoInterna: `Workflow "${definicao.titulo}" concluído.`,
      metadados: {
        workflow: buildLateralWorkflowDto(chamado, definicao),
      },
      alteracoes: [{ workflowCompleted: true, trigger: options.trigger }],
    });
    resolveTicketOnWorkflowFinished(chamado, autor);
    return { autoAdvanced: true };
  }

  const passo = passos[nextStep];
  wf.step = nextStep;
  wf.passoId = (passo._id as Types.ObjectId) || null;
  wf.pendingDecision = null;
  applyAtribuidoForPasso(chamado, passo);

  appendWorkflowRegistro(chamado, {
    autor,
    anotacaoInterna: `Workflow avançou para etapa "${passo.passo?.nome || nextStep}".`,
    metadados: {
      workflow: buildLateralWorkflowDto(chamado, definicao),
      workflowAdvance: {
        step: nextStep,
        passoId: passo._id ? String(passo._id) : null,
        trigger: options.trigger,
        skipped: options.skipped ?? false,
        decision: options.decision,
      },
    },
    alteracoes: [{ workflowStep: nextStep, passoNome: passo.passo?.nome }],
  });

  if (!options.skipSistema && isAutomaticaStep(passo.passo)) {
    const nested = await runSistemaIfNeeded(chamado, definicao, nextStep);
    return { autoAdvanced: nested.autoAdvanced };
  }

  return { autoAdvanced: false };
}

export async function activateWorkflowForChamado(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
  autor = 'Sistema',
  options: { requisicao?: IChamadoWorkflowRequisicao | null } = {},
): Promise<boolean> {
  const wf = ensureWorkflowState(chamado);
  if (wf.active && wf.workflowId) return false;

  const passos = sortPassos(definicao);
  const initialStep = 0;
  const passo = passos[initialStep];
  if (!passo) return false;

  wf.active = true;
  wf.workflowStatus = 'active';
  wf.workflowId = definicao._id as Types.ObjectId;
  wf.step = initialStep;
  wf.passoId = (passo._id as Types.ObjectId) || null;
  wf.startedAt = new Date();
  wf.completedAt = null;
  wf.pendingDecision = null;

  if (options.requisicao) {
    wf.requisicao = options.requisicao;
  }

  applyAtribuidoForPasso(chamado, passo);

  appendWorkflowRegistro(chamado, {
    autor,
    anotacaoInterna: `Workflow "${definicao.titulo}" ativado.`,
    metadados: {
      workflow: buildLateralWorkflowDto(chamado, definicao),
      ...(options.requisicao
        ? {
          requisicao: {
            valores: options.requisicao.valores,
            workflowId: String(definicao._id),
            campoIds: Object.keys(options.requisicao.valores || {}),
          },
        }
        : {}),
    },
    alteracoes: [{ workflowActivated: definicao.slug }],
  });

  await runSistemaIfNeeded(chamado, definicao, initialStep);
  return true;
}

export async function tryActivateWorkflowOnTabulation(
  chamado: IChamadoN1,
  autor = 'Sistema',
): Promise<boolean> {
  const wf = chamado.workflow;
  if (wf?.active && wf.workflowId) return false;
  // Conclusão permanece estável mesmo após reabertura/retabulação. Um novo
  // workflow pode ser iniciado explicitamente pelo agente.
  if (wf?.workflowStatus === 'finished') return false;

  const definicao = await resolveWorkflowForTicket(buildWorkflowTicketContextFromChamado(chamado));
  if (!definicao) return false;

  return activateWorkflowForChamado(chamado, definicao, autor);
}

function shouldAutoForwardAfterRequisicaoStart(
  definicao: IWorkflowDefinicao,
  stepIndex: number,
): boolean {
  const passos = sortPassos(definicao);
  if (stepIndex + 1 >= passos.length) return false;
  const passo = passoAtIndex(definicao, stepIndex);
  const p = passo?.passo;
  return (
    stepIndex === 0
    && p?.acao?.tipo === 'manual'
    && String(p?.atribuicao?.grupoSlug || '').toLowerCase() === 'n1'
  );
}

export async function startWorkflowForChamado(
  chamado: IChamadoN1,
  authUser?: AuthPayload | null,
  requisicaoValores?: Record<string, unknown>,
  definicaoSlug?: string,
  solicitacaoProdutos?: Record<string, unknown>,
): Promise<IChamadoN1> {
  const wf = chamado.workflow;
  if (wf?.active && wf.workflowId) {
    throw new WorkflowAdvanceError('Workflow já está ativo neste ticket', 400);
  }

  if (!isClientIdentifiedOnChamado(chamado)) {
    throw new WorkflowAdvanceError(
      'Identifique o cliente (CPF válido) antes de iniciar o workflow.',
      400,
    );
  }

  const ticketCtx = buildWorkflowTicketContextFromChamado(chamado);
  const fields = buildTabulationFieldsFromTicket(ticketCtx);
  const grupos = await getActiveGrupos();

  let definicao: IWorkflowDefinicao | null = null;
  const slug = String(definicaoSlug || '').trim();

  if (slug) {
    definicao = await getWorkflowBySlug(slug);
    if (!definicao || definicao.ativo === false) {
      throw new WorkflowAdvanceError('Workflow selecionado não encontrado ou inativo', 400);
    }
    if (!evaluateGatilhoCriterios(definicao.gatilho?.criterios || [], fields, grupos)) {
      throw new WorkflowAdvanceError('Tabulação não compatível com o workflow selecionado', 400);
    }
  } else {
    definicao = await resolveWorkflowForTicket(ticketCtx);
  }

  if (!definicao) {
    throw new WorkflowAdvanceError('Tabulação não compatível com nenhum workflow ativo', 400);
  }

  const requisicaoSnapshot = buildRequisicaoSnapshot(
    definicao,
    requisicaoValores,
    authUser,
    solicitacaoProdutos,
  );
  const autor = authUser?.name || authUser?.email || 'Agente';
  const activated = await activateWorkflowForChamado(chamado, definicao, autor, {
    requisicao: requisicaoSnapshot,
  });
  if (!activated) {
    throw new WorkflowAdvanceError('Não foi possível iniciar o workflow', 400);
  }

  applyRequisicaoToChamado(chamado, requisicaoSnapshot);

  const hasRequisicaoPayload = Boolean(
    (requisicaoValores && Object.keys(requisicaoValores).length)
    || (solicitacaoProdutos && Object.keys(solicitacaoProdutos).length),
  );
  const currentStep = chamado.workflow?.step ?? 0;
  if (
    hasRequisicaoPayload
    && shouldAutoForwardAfterRequisicaoStart(definicao, currentStep)
  ) {
    await advanceToStep(chamado, definicao, currentStep + 1, autor, {
      trigger: 'requisicao-start-forward',
    });
  }

  return chamado;
}

export async function canUserActOnStep(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
  authUser?: AuthPayload | null,
): Promise<boolean> {
  if (!authUser) return false;
  const wf = chamado.workflow;
  if (!wf?.active) return false;

  const passo = passoAtIndex(definicao, wf.step ?? 0);
  if (!passo) return false;

  const automatica = resolveAutomaticaConfig(passo.passo);

  if (isAutomaticaStep(passo.passo) && automatica?.modo !== 'call_to_action') {
    return false;
  }

  const atribuicao = passo.passo?.atribuicao;
  if (atribuicao?.tipo === 'sistema') {
    return automatica?.modo === 'call_to_action';
  }

  const isApproval = passo.passo?.acao?.tipo === 'aprovacao';
  return canUserActOnWorkflowStep(authUser, chamado, isApproval);
}

export async function advanceWorkflowManual(
  chamado: IChamadoN1,
  authUser?: AuthPayload | null,
): Promise<IChamadoN1> {
  const wf = chamado.workflow;
  if (!wf?.active || !wf.workflowId) {
    throw new WorkflowAdvanceError('Ticket sem workflow ativo', 400);
  }

  const definicao = await getWorkflowById(String(wf.workflowId));
  if (!definicao) throw new WorkflowAdvanceError('Definição de workflow não encontrada', 404);

  const allowed = await canUserActOnStep(chamado, definicao, authUser);
  if (!allowed) throw new WorkflowAdvanceError('Sem permissão para avançar esta etapa', 403);

  const passo = passoAtIndex(definicao, wf.step ?? 0);
  const acaoTipo = passo?.passo?.acao?.tipo;

  if (acaoTipo === 'aprovacao' && !wf.pendingDecision) {
    throw new WorkflowAdvanceError('Selecione Aprovado ou Reprovado antes de avançar', 400);
  }

  const autor = authUser?.name || authUser?.email || 'Agente';
  const currentStep = wf.step ?? 0;

  if (acaoTipo === 'aprovacao' && wf.pendingDecision === 'reject') {
    const targetIdx = resolveRotaProximoPassoIndex(definicao, passo, 'reject');
    if (targetIdx == null) {
      throw new WorkflowAdvanceError(
        'Etapa de destino para "Reprovar" não está configurada neste workflow. Ajuste a configuração antes de reprovar.',
        400,
      );
    }
    appendWorkflowRegistro(chamado, {
      autor,
      alteracoes: [{ workflowDecision: 'reject' }],
      metadados: { workflowDecision: 'reject' },
    });
    await advanceToStep(chamado, definicao, targetIdx, autor, {
      trigger: 'decision-reject',
      decision: 'reject',
      skipSistema: true,
    });
    wf.pendingDecision = null;
    markTicketEmAndamentoAfterReject(chamado, autor);
    await notifyWorkflowRejectToResponsavel(chamado, definicao);
    return chamado;
  }

  if (acaoTipo === 'aprovacao' && wf.pendingDecision === 'approve') {
    appendWorkflowRegistro(chamado, {
      autor,
      alteracoes: [{ workflowDecision: 'approve' }],
      metadados: { workflowDecision: 'approve' },
    });
    wf.pendingDecision = null;
  }

  await advanceToStep(chamado, definicao, currentStep + 1, autor, { trigger: 'manual-advance' });
  return chamado;
}

export function setWorkflowPendingDecision(
  chamado: IChamadoN1,
  decision: 'approve' | 'reject',
): void {
  const wf = ensureWorkflowState(chamado);
  if (!wf.active) throw new WorkflowAdvanceError('Ticket sem workflow ativo', 400);
  wf.pendingDecision = decision;
}

async function advanceWorkflowProdutosQueueDecision(
  chamado: IChamadoN1,
  decision: 'approve' | 'reject',
  authUser?: AuthPayload | null,
): Promise<IChamadoN1> {
  if (!authUser) {
    throw new WorkflowAdvanceError('Sem permissão para avançar esta etapa', 403);
  }

  const wf = chamado.workflow;
  if (!wf?.active || !wf.workflowId) {
    throw new WorkflowAdvanceError('Ticket sem workflow ativo', 400);
  }

  const resolved = await resolveUserPermissions(authUser);
  if (!canApproveWorkflow(resolved)) {
    throw new WorkflowAdvanceError('Sem permissão para aprovar/reprovar workflow', 403);
  }
  if (!(await ticketMatchesWorkflowTeamAsync(chamado, 'produtos'))) {
    throw new WorkflowAdvanceError('Ticket não pertence à fila Produtos', 403);
  }

  const definicao = await getWorkflowById(String(wf.workflowId));
  if (!definicao) throw new WorkflowAdvanceError('Definição de workflow não encontrada', 404);

  const produtosStepIdx = resolveProdutosApprovalStepIndex(definicao);
  if (produtosStepIdx == null) {
    setWorkflowPendingDecision(chamado, decision);
    return advanceWorkflowManual(chamado, authUser);
  }

  const autor = authUser.name || authUser.email || 'Agente';
  const currentStep = wf.step ?? 0;

  if (currentStep > produtosStepIdx) {
    setWorkflowPendingDecision(chamado, decision);
    return advanceWorkflowManual(chamado, authUser);
  }

  if (currentStep < produtosStepIdx) {
    await advanceToStep(chamado, definicao, produtosStepIdx, autor, {
      trigger: 'produtos-queue-skip',
      skipped: true,
    });
  }

  wf.pendingDecision = decision;

  if (decision === 'reject') {
    const ticketJaEncerrado = (MERGE_TERMINAL_STATUSES as readonly string[]).includes(currentStatus(chamado));

    if (!ticketJaEncerrado) {
      const ultimaOrigem = chamado.workflow?.requisicao?.comunicacaoResumo?.ultimaOrigem;
      if (ultimaOrigem !== 'workflow') {
        throw new WorkflowAdvanceError(
          'Envie uma comunicação ao responsável do ticket antes de reprovar.',
          400,
        );
      }
    }

    appendWorkflowRegistro(chamado, {
      autor,
      alteracoes: [{ workflowDecision: 'reject' }],
      metadados: { workflowDecision: 'reject' },
    });
    wf.pendingDecision = null;

    if (ticketJaEncerrado) {
      // Ticket já encerrado pelo agente responsável — reprovar aqui apenas conclui o
      // workflow (não precisa de "Retorno ao cliente" nem de nova comunicação).
      await advanceToStep(chamado, definicao, sortPassos(definicao).length, autor, {
        trigger: 'produtos-queue-reject-encerrado',
        decision: 'reject',
      });
      await notifyWorkflowRejectToResponsavel(chamado, definicao);
      return chamado;
    }

    const produtosPasso = passoAtIndex(definicao, produtosStepIdx);
    const targetIdx = resolveRotaProximoPassoIndex(definicao, produtosPasso, 'reject');
    if (targetIdx == null) {
      throw new WorkflowAdvanceError(
        'Etapa de destino para "Reprovar" não está configurada neste workflow. Ajuste a configuração antes de reprovar.',
        400,
      );
    }
    await advanceToStep(chamado, definicao, targetIdx, autor, {
      trigger: 'decision-reject',
      decision: 'reject',
      skipSistema: true,
    });
    markTicketEmAndamentoAfterReject(chamado, autor);
    await notifyWorkflowRejectToResponsavel(chamado, definicao);
    return chamado;
  }

  appendWorkflowRegistro(chamado, {
    autor,
    alteracoes: [{ workflowDecision: 'approve' }],
    metadados: { workflowDecision: 'approve' },
  });
  wf.pendingDecision = null;
  await appendProdutosConclusaoPublicMessage(chamado, autor);
  // "Feito" em produtos encerra o workflow — mensagem ao cliente já persistida acima.
  await advanceToStep(chamado, definicao, sortPassos(definicao).length, autor, {
    trigger: 'produtos-queue-feito',
    decision: 'approve',
  });
  return chamado;
}

export async function advanceWorkflowWithDecision(
  chamado: IChamadoN1,
  decision: 'approve' | 'reject',
  authUser?: AuthPayload | null,
): Promise<IChamadoN1> {
  if (authUser) {
    const resolved = await resolveUserPermissions(authUser);
    const teamQueue = resolveWorkflowTeamQueueForUser(resolved);
    if (teamQueue === 'produtos') {
      const belongsToProdutos = await ticketMatchesWorkflowTeamAsync(chamado, 'produtos')
        || await matchesWorkflowDefinitionTeam(resolved, chamado);
      if (belongsToProdutos) {
        return advanceWorkflowProdutosQueueDecision(chamado, decision, authUser);
      }
    }
  }

  setWorkflowPendingDecision(chamado, decision);
  return advanceWorkflowManual(chamado, authUser);
}

/**
 * Uma mensagem pública cumpre o último passo quando ele é uma devolutiva.
 * Outros tipos de último passo continuam sendo concluídos pelo executor/botão
 * de avanço correspondente, sem amarrar o encerramento geral a mensagens.
 */
export async function finishWorkflowAfterPublicReply(
  chamado: IChamadoN1,
  autor = 'Agente',
): Promise<boolean> {
  const wf = chamado.workflow;
  if (!wf?.active || !wf.workflowId || wf.workflowStatus === 'finished') return false;

  const definicao = await getWorkflowById(String(wf.workflowId));
  if (!definicao) return false;

  const passos = sortPassos(definicao);
  const lastStepIndex = passos.length - 1;
  if (lastStepIndex < 0 || (wf.step ?? 0) !== lastStepIndex) return false;

  const lastPasso = passos[lastStepIndex];
  if (!isDevolutivaPasso(lastPasso.passo?.nome || '')) return false;

  await advanceToStep(chamado, definicao, passos.length, autor, {
    trigger: 'devolutiva-publica-enviada',
  });
  return true;
}

/** Interrompe workflow ativo sem impedir novo start futuro (tabulação intacta). */
export async function cancelWorkflowForChamado(
  chamado: IChamadoN1,
  authUser?: AuthPayload | null,
  motivo?: string,
): Promise<IChamadoN1> {
  const wf = ensureWorkflowState(chamado);
  if (!wf.active || !wf.workflowId) {
    throw new WorkflowAdvanceError('Ticket sem workflow ativo', 400);
  }

  const definicao = await getWorkflowById(String(wf.workflowId));
  const titulo = definicao?.titulo || 'Workflow';
  const autor = authUser?.name || authUser?.email || 'Gestão';

  const lateralSnapshot = definicao
    ? buildLateralWorkflowDto(chamado, definicao)
    : null;

  wf.active = false;
  wf.workflowStatus = null;
  wf.workflowId = null;
  wf.step = 0;
  wf.passoId = null;
  wf.startedAt = null;
  wf.completedAt = null;
  wf.pendingDecision = null;
  delete wf.requisicao;

  const tab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  chamado.tabulacao = [{ ...tab, atribuido: '' }];

  appendWorkflowRegistro(chamado, {
    autor,
    anotacaoInterna: motivo
      ? `Workflow "${titulo}" interrompido: ${motivo}`
      : `Workflow "${titulo}" interrompido.`,
    metadados: {
      workflowInterrupted: true,
      workflow: lateralSnapshot,
    },
    alteracoes: [{ workflowInterrupted: true, workflowTitulo: titulo }],
  });

  return chamado;
}
