/** workflowDto.util v1.0.1 — sync legacy lateralForm.workflow → top-level */
import { Types } from 'mongoose';
import type { IChamadoN1, IChamadoWorkflow } from '../models/ChamadoN1';
import type { IWorkflowDefinicao, IWorkflowPassoEnvelope } from '../models/WorkflowDefinicao';
import { getWorkflowById, resolveWorkflowForTicket } from './workflowDefinicao.service';

function sortPassos(definicao: IWorkflowDefinicao): IWorkflowPassoEnvelope[] {
  return [...(definicao.passos || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export function buildLateralWorkflowDto(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
): Record<string, unknown> | null {
  const wf = chamado.workflow;
  if (!wf?.active || !wf.workflowId) return null;

  const passos = sortPassos(definicao);
  const step = Math.min(Math.max(wf.step ?? 0, 0), Math.max(passos.length - 1, 0));
  const currentPasso = passos[step];
  const currentStepId = currentPasso?._id ? String(currentPasso._id) : '';
  const startedAt = wf.startedAt ? new Date(wf.startedAt).toISOString() : new Date().toISOString();
  const completedAt = wf.completedAt ? new Date(wf.completedAt).toISOString() : null;

  const stepHistory = passos.map((p, index) => {
    const stepId = String(p._id);
    let status: 'completed' | 'active' | 'pending' | 'skipped' = 'pending';
    if (wf.completedAt || index < step) status = 'completed';
    else if (index === step && !wf.completedAt) status = 'active';
    return {
      stepId,
      status,
      at: startedAt,
      by: 'sistema',
      trigger: index === step ? 'active' : 'history',
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
    status: wf.completedAt ? 'completed' : 'active',
    stepHistory,
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
    wf.active = true;
    wf.workflowId = new Types.ObjectId(String(definicaoId));
    wf.step = step ?? 0;
    wf.startedAt = lateralWorkflow.startedAt ? new Date(String(lateralWorkflow.startedAt)) : new Date();
    wf.completedAt = lateralWorkflow.completedAt ? new Date(String(lateralWorkflow.completedAt)) : null;
    if (lateralWorkflow.currentStepId) {
      wf.passoId = new Types.ObjectId(String(lateralWorkflow.currentStepId));
    }
  }
}
