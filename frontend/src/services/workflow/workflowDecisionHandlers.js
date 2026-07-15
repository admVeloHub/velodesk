/**
 * workflowDecisionHandlers v1.1.0 — aprovar / reprovar / pedir informação
 */
import { updateTicketInCache, getAllCockpitTickets } from '../ticketsStorage';
import {
  advanceTicketWorkflow,
  advanceTicketWorkflowByDecision,
  getAgentName,
  getTicketProtocolLabel,
  getWorkflowProgress,
  getWorkflowTemplateForTicket,
} from '../desk/utils';
import { buildWorkflowAdvanceMessage, ticketAwaitingDecision } from '../desk/workflowDefinitions';
import { createWorkflowInfoRequest } from './workflowInfoNotifications';

function pushSystemMessage(ticket, text) {
  const ts = new Date().toISOString();
  if (!ticket.messages) ticket.messages = [];
  ticket.messages.push({
    id: `wf-decision-${Date.now()}`,
    type: 'system',
    fromClient: false,
    origin: 'sistema',
    text,
    timestamp: ts,
    author: 'Sistema',
  });
}

function applyApprove(ticket) {
  const author = getAgentName() || 'Operador';
  const result = advanceTicketWorkflowByDecision(ticket, 'approve', author);
  if (!result.advanced) {
    advanceTicketWorkflow(ticket, author);
  }
  return ticket;
}

function applyReject(ticket, reason = '') {
  const author = getAgentName() || 'Operador';
  const note = reason.trim() || 'Solicitação reprovada na etapa de decisão.';
  const lf = ticket.lateralForm || {};
  const wf = lf.workflow || {};
  const template = getWorkflowTemplateForTicket(ticket);
  const progress = getWorkflowProgress(ticket);
  const stepId = progress?.activeStep?.id || wf.currentStepId;
  const stepLabel = progress?.activeStep?.label || stepId;
  const history = [...(wf.stepHistory || [])];
  const now = new Date().toISOString();

  const activeIdx = history.findIndex((h) => h.status === 'active' && h.stepId === stepId);
  if (activeIdx >= 0) {
    history[activeIdx] = {
      ...history[activeIdx],
      status: 'completed',
      decision: 'rejected',
      trigger: 'decision-reject',
      at: now,
      by: author,
      note,
    };
  } else {
    history.push({
      stepId,
      status: 'completed',
      decision: 'rejected',
      trigger: 'decision-reject',
      at: now,
      by: author,
      note,
    });
  }

  ticket.lateralForm = {
    ...lf,
    workflow: {
      ...wf,
      stepHistory: history,
      status: 'rejected',
      rejectedAt: now,
      rejectedBy: author,
      rejectionReason: note,
    },
  };
  const rejectRota = progress?.activeStep?.acao?.rotas?.find((r) => r.variavel === 'reject')
    || progress?.activeStep?.decision?.rotas?.find((r) => r.variavel === 'reject');
  ticket.status = rejectRota?.statusTicket || 'pendente';

  if (!ticket.internalNotes) ticket.internalNotes = [];
  ticket.internalNotes.push({
    id: `wf-reject-${Date.now()}`,
    type: 'internal',
    text: `[Workflow] Reprovado por ${author}: ${note}`,
    timestamp: now,
    author,
  });

  pushSystemMessage(
    ticket,
    `Workflow **${template?.title || 'ativo'}** reprovado por ${author} na etapa "${stepLabel}".`,
  );
  return ticket;
}

function extractForwardingNote(ticket) {
  const lf = ticket?.lateralForm || {};
  const approval = lf.approval || {};
  if (approval.forwardingNote) return approval.forwardingNote;
  if (approval.notaEncaminhamento) return approval.notaEncaminhamento;

  const notes = ticket?.internalNotes || [];
  const note = [...notes].reverse().find((n) => {
    const text = String(n.text || '').trim();
    return text && !/^\[Workflow\]/i.test(text);
  });
  return note?.text || null;
}

function buildInfoRequestSystemText(author, stepLabel, note) {
  return `[Workflow] Pedido de informação — ${author} (${stepLabel}): ${note}`;
}

function mirrorInfoRequestFromSource(target, source) {
  const sourceWf = source.lateralForm?.workflow || {};
  const sourceLf = source.lateralForm || {};
  const note = String(sourceWf.infoRequestNote || '').trim();
  if (!note) return target;

  const author = sourceWf.infoRequestedBy || 'Operador Workflow';
  const now = sourceWf.infoRequestedAt || new Date().toISOString();
  const progress = getWorkflowProgress(source);
  const stepLabel = progress?.activeStep?.label || 'decisão';
  const noteId = `wf-info-${now}`;
  const systemText = buildInfoRequestSystemText(author, stepLabel, note);

  const alreadyMirrored = (target.internalNotes || []).some((n) => n.id === noteId)
    || (target.messages || []).some((m) => m.id === noteId);

  if (alreadyMirrored) return target;

  target.status = 'pendente';

  if (!target.internalNotes) target.internalNotes = [];
  target.internalNotes.push({
    id: noteId,
    type: 'internal',
    text: `[Workflow] Pedido de informação por ${author} (${stepLabel}): ${note}`,
    timestamp: now,
    author,
  });

  target.lateralForm = {
    ...(target.lateralForm || {}),
    approval: {
      ...((target.lateralForm || {}).approval || {}),
      forwardingNote: sourceLf.approval?.forwardingNote || extractForwardingNote(target),
    },
    workflow: {
      ...((target.lateralForm || {}).workflow || {}),
      infoRequestedAt: now,
      infoRequestedBy: author,
      infoRequestNote: note,
    },
  };

  if (!target.messages) target.messages = [];
  target.messages.push({
    id: noteId,
    type: 'system',
    fromClient: false,
    origin: 'sistema',
    text: systemText,
    timestamp: now,
    author: 'Workflow',
  });

  return target;
}

async function syncInfoRequestToTickets(sourceTicket) {
  const protocol = getTicketProtocolLabel(sourceTicket);
  if (!protocol) return;

  const matches = getAllCockpitTickets().filter(
    ({ ticket }) => String(ticket.id) !== String(sourceTicket.id)
      && getTicketProtocolLabel(ticket) === protocol,
  );

  await Promise.all(
    matches.map(({ ticket }) => updateTicketInCache(ticket.id, (t) => mirrorInfoRequestFromSource(t, sourceTicket))),
  );
}

function applyRequestInfo(ticket, message = '') {
  const author = getAgentName() || 'Operador';
  const note = message.trim() || 'Informações adicionais solicitadas antes da decisão.';
  const lf = ticket.lateralForm || {};
  const wf = lf.workflow || {};
  const progress = getWorkflowProgress(ticket);
  const stepLabel = progress?.activeStep?.label || 'decisão';
  const now = new Date().toISOString();
  const noteId = `wf-info-${now}`;

  ticket.status = 'pendente';

  if (!ticket.internalNotes) ticket.internalNotes = [];
  ticket.internalNotes.push({
    id: noteId,
    type: 'internal',
    text: `[Workflow] Pedido de informação por ${author} (${stepLabel}): ${note}`,
    timestamp: now,
    author,
  });

  ticket.lateralForm = {
    ...lf,
    approval: {
      ...(lf.approval || {}),
      forwardingNote: lf.approval?.forwardingNote || extractForwardingNote(ticket),
    },
    workflow: {
      ...wf,
      infoRequestedAt: now,
      infoRequestedBy: author,
      infoRequestNote: note,
    },
  };

  pushSystemMessage(
    ticket,
    buildInfoRequestSystemText(author, stepLabel, note),
  );

  createWorkflowInfoRequest({
    ticketId: ticket.id,
    clientName: ticket.clientName || ticket.solicitante,
    ticketSubject: ticket.title || ticket.chamadoTitulo,
    message: note,
    requestedBy: author,
    targetAgent: lf.responsavel || ticket.responsibleAgent || '',
    stepLabel,
    protocol: getTicketProtocolLabel(ticket) || String(ticket.id),
  });

  return ticket;
}

export async function approveWorkflowDecision(ticketId) {
  return updateTicketInCache(ticketId, (ticket) => applyApprove(ticket));
}

export async function rejectWorkflowDecision(ticketId, reason = '') {
  return updateTicketInCache(ticketId, (ticket) => applyReject(ticket, reason));
}

export async function requestWorkflowInfo(ticketId, message = '') {
  return updateTicketInCache(ticketId, (ticket) => applyRequestInfo(ticket, message));
}
