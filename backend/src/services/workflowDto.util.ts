/** workflowDto.util v1.4.0 — stepHistory com estado denied após reprovação */
import { Types } from 'mongoose';
import type { IChamadoN1, IChamadoWorkflow, IRegistro } from '../models/ChamadoN1';
import type { IWorkflowDefinicao, IWorkflowPassoEnvelope } from '../models/WorkflowDefinicao';
import { getWorkflowById, resolveWorkflowForTicket } from './workflowDefinicao.service';

function sortPassos(definicao: IWorkflowDefinicao): IWorkflowPassoEnvelope[] {
  return [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function registroHasWorkflowReject(registro: IRegistro[] = []): boolean {
  return registro.some((row) => {
    if (row.metadados?.workflowDecision === 'reject') return true;
    return (row.alteracoes || []).some(
      (item) => (item as Record<string, unknown>)?.workflowDecision === 'reject',
    );
  });
}

/** Índice do passo de aprovação reprovado (para stepper denied). */
function resolveRejectedApprovalStepIndex(
  chamado: IChamadoN1,
  passos: IWorkflowPassoEnvelope[],
): number | null {
  if (!registroHasWorkflowReject(chamado.registro || [])) return null;
  const step = Math.min(Math.max(chamado.workflow?.step ?? 0, 0), Math.max(passos.length - 1, 0));
  for (let index = step; index >= 0; index -= 1) {
    if (passos[index]?.passo?.acao?.tipo === 'aprovacao') return index;
  }
  return null;
}

function buildPassosResumo(definicao: IWorkflowDefinicao) {
  return sortPassos(definicao).map((envelope) => {
    const cfg = envelope.passo || {};
    return {
      id: String(envelope._id),
      nome: String(cfg.nome || 'Etapa').trim() || 'Etapa',
      ordem: envelope.ordem ?? 0,
      acaoTipo: cfg.acao?.tipo || 'manual',
      team: cfg.atribuicao?.funcaoSlug
        || cfg.atribuicao?.grupoSlug
        || (cfg.atribuicao?.tipo === 'colaborador' ? 'n1' : 'n1'),
      slaHoras: cfg.slaHoras ?? null,
    };
  });
}

export function buildLateralWorkflowDto(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
): Record<string, unknown> | null {
  const wf = chamado.workflow;
  const finished = wf?.workflowStatus === 'finished';
  const cancelled = wf?.workflowStatus === 'cancel';
  if ((!wf?.active && !finished && !cancelled) || !wf.workflowId) return null;

  const passos = sortPassos(definicao);
  const step = Math.min(Math.max(wf.step ?? 0, 0), Math.max(passos.length - 1, 0));
  const rejectedStepIdx = resolveRejectedApprovalStepIndex(chamado, passos);
  const currentPasso = passos[step];
  const currentStepId = currentPasso?._id ? String(currentPasso._id) : '';
  const startedAt = wf.startedAt ? new Date(wf.startedAt).toISOString() : new Date().toISOString();
  const completedAt = wf.completedAt ? new Date(wf.completedAt).toISOString() : null;

  const stepHistory = passos.map((p, index) => {
    const stepId = String(p._id);
    let status: 'completed' | 'active' | 'pending' | 'skipped' | 'denied' = 'pending';
    if (rejectedStepIdx != null && index === rejectedStepIdx) {
      status = 'denied';
    } else if (cancelled) {
      status = index < step ? 'completed' : 'skipped';
    } else if (finished || wf.completedAt || index < step) {
      status = 'completed';
    } else if (index === step && !wf.completedAt) {
      status = 'active';
    }
    return {
      stepId,
      status,
      at: startedAt,
      by: 'sistema',
      trigger: index === step ? 'active' : 'history',
      label: String(p.passo?.nome || '').trim() || undefined,
    };
  });

  return {
    templateId: definicao.slug,
    definicaoSlug: definicao.slug,
    definicaoId: String(definicao._id),
    title: definicao.titulo,
    currentStepId,
    step,
    startedAt,
    completedAt,
    status: finished ? 'completed' : cancelled ? 'cancelled' : 'active',
    workflowStatus: wf.workflowStatus ?? (wf.active ? 'active' : null),
    stepHistory,
    passosResumo: buildPassosResumo(definicao),
    pendingDecision: wf.pendingDecision ?? null,
  };
}

export async function loadWorkflowDefForChamado(chamado: IChamadoN1): Promise<IWorkflowDefinicao | null> {
  const wf = chamado.workflow;
  if (wf?.workflowId) {
    return getWorkflowById(String(wf.workflowId));
  }
  return resolveWorkflowForTicket({
    tabulacao: chamado.tabulacao as unknown as Array<Record<string, string>>,
  });
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

export function syncLegacyWorkflowFromBody(
  chamado: IChamadoN1,
  lateralWorkflow: Record<string, unknown> | undefined,
): void {
  if (!lateralWorkflow || typeof lateralWorkflow !== 'object') return;
  const wf = ensureWorkflowState(chamado);
  if (wf.active && wf.workflowId) return;

  const definicaoId = lateralWorkflow.definicaoId || lateralWorkflow.workflowId;
  const step = typeof lateralWorkflow.step === 'number'
    ? lateralWorkflow.step
    : undefined;

  if (definicaoId) {
    const finished = lateralWorkflow.workflowStatus === 'finished'
      || lateralWorkflow.status === 'completed';
    wf.active = !finished;
    wf.workflowStatus = finished ? 'finished' : 'active';
    wf.workflowId = new Types.ObjectId(String(definicaoId));
    wf.step = step ?? 0;
    wf.startedAt = lateralWorkflow.startedAt ? new Date(String(lateralWorkflow.startedAt)) : new Date();
    wf.completedAt = lateralWorkflow.completedAt ? new Date(String(lateralWorkflow.completedAt)) : null;
    if (lateralWorkflow.currentStepId) {
      wf.passoId = new Types.ObjectId(String(lateralWorkflow.currentStepId));
    }
  }
}
