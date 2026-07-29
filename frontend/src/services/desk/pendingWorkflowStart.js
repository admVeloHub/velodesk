/**
 * pendingWorkflowStart v1.1.0 — discardPendingWorkflowStart para interromper cache
 * VERSION: v1.1.0 | DATE: 2026-07-28
 */
import { getAgentName } from '../clientDb';
import { createWorkflowState } from './workflowEngine';

export function hasPendingWorkflowPersist(ticket) {
  return Boolean(ticket?._pendingWorkflowStart?.definicaoSlug);
}

export function buildStartWorkflowApiBody(pending) {
  if (!pending?.definicaoSlug) return null;
  return {
    definicaoSlug: pending.definicaoSlug,
    ...(pending.requisicao ? { requisicao: pending.requisicao } : {}),
  };
}

export function applyPendingWorkflowStartToTicket(ticket, template, requisicaoValores, author) {
  if (!ticket || !template) return ticket;

  const workflow = createWorkflowState(template, {
    by: author || getAgentName() || 'agente',
    trigger: 'manual-start-pending',
  });

  ticket.lateralForm = {
    ...(ticket.lateralForm || {}),
    workflow,
  };
  ticket.workflow = {
    ...(ticket.workflow || {}),
    active: true,
    pendingPersist: true,
  };
  ticket._pendingWorkflowStart = {
    definicaoSlug: template.id,
    templateTitle: template.title,
    ...(requisicaoValores && Object.keys(requisicaoValores).length
      ? { requisicao: { valores: requisicaoValores } }
      : {}),
  };

  return ticket;
}

export function clearPendingWorkflowStart(ticket) {
  if (!ticket) return ticket;
  delete ticket._pendingWorkflowStart;
  if (ticket.workflow?.pendingPersist) {
    const nextWorkflow = { ...ticket.workflow };
    delete nextWorkflow.pendingPersist;
    ticket.workflow = Object.keys(nextWorkflow).length ? nextWorkflow : undefined;
  }
  return ticket;
}

/** Descarta workflow pendente em cache (antes do save). */
export function discardPendingWorkflowStart(ticket) {
  if (!ticket) return ticket;
  delete ticket._pendingWorkflowStart;
  delete ticket.workflow;
  if (ticket.lateralForm) {
    const next = { ...ticket.lateralForm };
    delete next.workflow;
    ticket.lateralForm = Object.keys(next).length ? next : undefined;
  }
  return ticket;
}

/** Mescla resposta da API preservando workflow pendente só em cache */
export function mergeApiTicketPreservingPendingWorkflow(prev, apiTicket) {
  if (!hasPendingWorkflowPersist(prev) || !apiTicket) return apiTicket;

  const merged = { ...apiTicket };
  merged._pendingWorkflowStart = prev._pendingWorkflowStart;
  merged.lateralForm = {
    ...(apiTicket.lateralForm || {}),
    workflow: prev.lateralForm?.workflow || apiTicket.lateralForm?.workflow,
  };
  merged.workflow = {
    ...(apiTicket.workflow || {}),
    active: true,
    pendingPersist: true,
  };
  return merged;
}

export async function persistPendingWorkflowStart(ticketId, ticket, ticketsApi) {
  const pending = ticket?._pendingWorkflowStart;
  const body = buildStartWorkflowApiBody(pending);
  if (!body) return null;

  const updated = await ticketsApi.startWorkflow(ticketId, body);
  return updated;
}

export async function flushPendingWorkflowOnSave(ticketId, ticket, deps) {
  if (!hasPendingWorkflowPersist(ticket)) return { flushed: false };

  const pending = ticket._pendingWorkflowStart;
  const { ticketsApi, apiTicketToCockpit, patchTicket, injectWorkflowSystemMessage } = deps;

  try {
    const updated = await persistPendingWorkflowStart(ticketId, ticket, ticketsApi);
    const merged = apiTicketToCockpit(updated);
    clearPendingWorkflowStart(merged);
    injectWorkflowSystemMessage(merged, { title: pending?.templateTitle || 'Workflow' });
    patchTicket(ticketId, merged);
    return { flushed: true, ticket: merged };
  } catch (err) {
    return { flushed: false, error: err };
  }
}
