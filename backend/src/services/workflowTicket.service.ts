/** workflowTicket.service v1.6.0 — startWorkflow sem bloqueio por slug legado */
import { isAutomaticaStep, resolveAutomaticaConfig } from './workflowAutomatica.util';
import { Types } from 'mongoose';
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1, IChamadoWorkflow, IRegistro } from '../models/ChamadoN1';
import type { IWorkflowDefinicao, IWorkflowPassoEnvelope } from '../models/WorkflowDefinicao';
import {
  currentStatus,
  readTabulacaoSnapshot,
} from './chamado.mapper';
import { getWorkflowById, getWorkflowBySlug, resolveWorkflowForTicket } from './workflowDefinicao.service';
import { getActiveGrupos } from './grupoResponsabilidade.service';
import {
  buildTabulationFieldsFromTicket,
  evaluateGatilhoCriterios,
  resolveAtribuidoForPasso,
} from './workflowMatcher.service';
import {
  canUserActOnWorkflowStep,
} from './permission.service';
import { executeSistemaStep, isDevolutivaPasso } from './workflowSistemaExecutor.service';
import { buildLateralWorkflowDto } from './workflowDto.util';
import {
  applyRequisicaoToChamado,
  buildRequisicaoSnapshot,
} from './workflowRequisicao.service';
import type { IChamadoWorkflowRequisicao } from '../config/workflowRequisicaoDefaults';

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

export function resolveDevolutivaStepIndex(definicao: IWorkflowDefinicao): number {
  const passos = sortPassos(definicao);
  const idx = passos.findIndex((p) => isDevolutivaPasso(p.passo?.nome || ''));
  return idx >= 0 ? idx : passos.length - 1;
}

function ensureWorkflowState(chamado: IChamadoN1): IChamadoWorkflow {
  if (!chamado.workflow) {
    chamado.workflow = {
      active: false,
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
  const fields = buildTabulationFieldsFromTicket({
    tabulacao: chamado.tabulacao as unknown as Array<Record<string, string>>,
  });
  const atribuido = resolveAtribuidoForPasso(passo.passo?.atribuicao || { tipo: 'funcao', funcaoSlug: 'atendimento', colaborador: '' }, fields);
  if (!atribuido) return;
  const tab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  chamado.tabulacao = [{ ...tab, atribuido }];
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
  options: { trigger?: string; skipped?: boolean; decision?: string } = {},
): Promise<{ autoAdvanced: boolean }> {
  const wf = ensureWorkflowState(chamado);
  const passos = sortPassos(definicao);

  if (nextStep >= passos.length) {
    wf.step = passos.length > 0 ? passos.length - 1 : 0;
    wf.completedAt = new Date();
    wf.active = false;
    wf.pendingDecision = null;
    appendWorkflowRegistro(chamado, {
      autor,
      anotacaoInterna: `Workflow "${definicao.titulo}" concluído.`,
      metadados: {
        workflow: buildLateralWorkflowDto(chamado, definicao),
      },
      alteracoes: [{ workflowCompleted: true, trigger: options.trigger }],
    });
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

  if (isAutomaticaStep(passo.passo)) {
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

  const definicao = await resolveWorkflowForTicket({
    tabulacao: chamado.tabulacao as unknown as Array<Record<string, string>>,
  });
  if (!definicao) return false;

  return activateWorkflowForChamado(chamado, definicao, autor);
}

export async function startWorkflowForChamado(
  chamado: IChamadoN1,
  authUser?: AuthPayload | null,
  requisicaoValores?: Record<string, unknown>,
  definicaoSlug?: string,
): Promise<IChamadoN1> {
  const wf = chamado.workflow;
  if (wf?.active && wf.workflowId) {
    throw new WorkflowAdvanceError('Workflow já está ativo neste ticket', 400);
  }

  const tab = readTabulacaoSnapshot(chamado.tabulacao?.[0]);
  const meta = (chamado.metadados && typeof chamado.metadados === 'object')
    ? chamado.metadados as Record<string, unknown>
    : {};
  const ticketCtx = {
    tabulacao: [tab as unknown as Record<string, string>],
    lateralForm: {
      tipoChamado: tab.tipoChamado,
      classificacaoTipo: tab.tipoChamado,
      produto: tab.produto,
      motivo: tab.motivo,
      detalhe: tab.detalhe,
      responsavel: tab.responsavel,
      atribuido: tab.atribuido,
      canal: String(meta.canal ?? meta.channel ?? ''),
      metadados: meta,
    },
  };
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

  const requisicaoSnapshot = buildRequisicaoSnapshot(definicao, requisicaoValores, authUser);
  const autor = authUser?.name || authUser?.email || 'Agente';
  const activated = await activateWorkflowForChamado(chamado, definicao, autor, {
    requisicao: requisicaoSnapshot,
  });
  if (!activated) {
    throw new WorkflowAdvanceError('Não foi possível iniciar o workflow', 400);
  }

  applyRequisicaoToChamado(chamado, requisicaoSnapshot);

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
    const devolutivaIdx = resolveDevolutivaStepIndex(definicao);
    await advanceToStep(chamado, definicao, devolutivaIdx, autor, {
      trigger: 'decision-reject',
      skipped: devolutivaIdx > currentStep + 1,
      decision: 'reject',
    });
    wf.pendingDecision = null;
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

export async function advanceWorkflowWithDecision(
  chamado: IChamadoN1,
  decision: 'approve' | 'reject',
  authUser?: AuthPayload | null,
): Promise<IChamadoN1> {
  setWorkflowPendingDecision(chamado, decision);
  return advanceWorkflowManual(chamado, authUser);
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
