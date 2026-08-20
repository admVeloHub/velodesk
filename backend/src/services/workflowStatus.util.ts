/** workflowStatus.util v1.0.0 — contrato active | finished | cancel */
import type { IChamadoN1, IChamadoWorkflow } from '../models/ChamadoN1';
import { WORKFLOW_STATUS_VALUES } from '../models/ChamadoN1';

export { WORKFLOW_STATUS_VALUES };

const TICKET_TERMINAL_STATUSES = new Set(['resolvido', 'cancelado', 'fechado']);

export type WorkflowRuntimeStatus = (typeof WORKFLOW_STATUS_VALUES)[number];

export function isWorkflowStatusClosed(status?: string | null): boolean {
  return status === 'finished' || status === 'cancel';
}

export function hasPersistedWorkflowSnapshot(wf?: Pick<IChamadoWorkflow, 'active' | 'workflowStatus' | 'workflowId'> | null): boolean {
  if (!wf?.workflowId) return false;
  if (isWorkflowStatusClosed(wf.workflowStatus)) return true;
  return Boolean(wf.active);
}

export function isWorkflowOperable(
  wf?: Pick<IChamadoWorkflow, 'active' | 'workflowStatus' | 'workflowId'> | null,
  ticketStatus?: string,
): boolean {
  if (ticketStatus && TICKET_TERMINAL_STATUSES.has(ticketStatus)) {
    if (wf?.workflowStatus !== 'finished') return false;
  }
  if (!wf?.workflowId) return false;
  if (isWorkflowStatusClosed(wf.workflowStatus)) return false;
  return Boolean(wf.active);
}

/**
 * Ticket encerrado com WF ainda aberto → workflowStatus cancel.
 * Não sobrescreve finished. Interromper WF (endpoint cancel) continua zerando o bloco.
 */
export function markWorkflowCancelledOnTicketClose(
  chamado: IChamadoN1,
  ticketStatus: string,
): void {
  if (!TICKET_TERMINAL_STATUSES.has(ticketStatus)) return;
  const wf = chamado.workflow;
  if (!wf) return;
  if (wf.workflowStatus === 'finished') return;
  if (wf.workflowStatus === 'cancel') {
    wf.active = false;
    wf.pendingDecision = null;
    return;
  }
  const open = wf.workflowStatus === 'active' || Boolean(wf.active && wf.workflowId);
  if (!open) return;
  wf.active = false;
  wf.workflowStatus = 'cancel';
  wf.pendingDecision = null;
  if (!wf.completedAt) wf.completedAt = new Date();
}
