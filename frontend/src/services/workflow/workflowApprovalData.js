/**
 * workflowApprovalData v1.2.1 — fila e detalhe do console de decisão
 */
import { getAllCockpitTickets } from '../kanbanStorage';
import { getSlaClass, getWorkflowProgress, isTicketInWorkflow, getTicketProtocolLabel, getAgentName } from '../desk/utils';
import { resolveApprovalHeader, ticketAwaitingDecision } from '../desk/workflowDefinitions';
import { getRuntimeGrupos } from '../desk/workflowRuntimeStore';

const QUEUE_LABEL = 'Aguardando aprovação';

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isPerfilDeskAmplo(valor) {
  const v = String(valor || '').trim();
  return v === 'agent' || v === 'gestao' || v === 'supervisor';
}

function agentCanDecideTicket(ticket) {
  const atribuido = String(ticket?.lateralForm?.atribuido || '').trim();
  const agent = normalizeText(getAgentName());
  if (!atribuido || !agent) return true;

  if (atribuido.startsWith('grupo:')) {
    const slug = atribuido.slice(6);
    const grupo = getRuntimeGrupos().find((g) => g.slug === slug);
    if (!grupo) return false;
    if (!grupo.membros?.length) return true;
    return grupo.membros.some((m) => {
      const val = normalizeText(m.valor);
      if (m.tipo === 'colaborador') return val === agent || agent.includes(val);
      if (m.tipo === 'email') return val === agent || agent.includes(val);
      if (m.tipo === 'perfil_desk') return isPerfilDeskAmplo(m.valor);
      return false;
    });
  }

  return normalizeText(atribuido) === agent || atribuido.toLowerCase().includes(agent);
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function formatElapsedSince(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${min}min`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function channelLabel(ticket) {
  const channel = (ticket.lateralForm?.canal || ticket.channel || ticket.source || '').toLowerCase();
  if (channel.includes('whats')) return { label: 'WhatsApp', icon: 'fab fa-whatsapp' };
  if (channel.includes('mail') || channel.includes('email')) return { label: 'E-mail', icon: 'fas fa-envelope' };
  if (channel.includes('phone') || channel.includes('telefone') || channel.includes('tel')) {
    return { label: 'Telefone', icon: 'fas fa-phone' };
  }
  if (channel.includes('portal')) return { label: 'Portal', icon: 'fas fa-globe' };
  return { label: 'Digital', icon: 'fas fa-comment' };
}

function readApprovalMeta(ticket) {
  const lf = ticket?.lateralForm || {};
  return lf.approval || lf.metadados?.approval || {};
}

function isWorkflowSystemNote(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  return /^\[Workflow\]/i.test(value)
    || /Pedido de informação por/i.test(value)
    || /Reprovado por/i.test(value)
    || /^Decisão \*\*/i.test(value);
}

function getFirstClientMessage(ticket) {
  const messages = ticket?.messages || [];
  const clientMsg = messages.find((m) => {
    if (m.type === 'system' || m.type === 'internal') return false;
    return m.fromClient || m.type === 'client' || m.origin === 'cliente';
  });
  if (clientMsg?.text) return clientMsg.text;

  const approval = readApprovalMeta(ticket);
  if (approval.clientSummary) return approval.clientSummary;

  return '';
}

function getInternalForwardingNote(ticket) {
  const approval = readApprovalMeta(ticket);
  if (approval.forwardingNote) return approval.forwardingNote;
  if (approval.notaEncaminhamento) return approval.notaEncaminhamento;

  const notes = ticket?.internalNotes || [];
  const forwardingNote = [...notes].reverse().find((n) => !isWorkflowSystemNote(n.text));
  if (forwardingNote?.text) return forwardingNote.text;

  const messages = ticket?.messages || [];
  const internal = [...messages].reverse().find((m) => {
    if (m.type !== 'internal' && m.origin !== 'agente') return false;
    return !isWorkflowSystemNote(m.text);
  });
  if (internal?.text) return internal.text;

  return 'Atendimento confirmou elegibilidade e encaminhou para aprovação.';
}

function formatCurrency(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value || '—');
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function inferDaysSincePurchase(approval, ticket) {
  if (approval.diasDesdeCompra != null) return approval.diasDesdeCompra;
  if (approval.dataCompra) {
    const diff = Date.now() - new Date(approval.dataCompra).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }
  const msg = getFirstClientMessage(ticket);
  const match = msg.match(/(\d+)\s*dias?/i);
  if (match) return Number(match[1]);
  return 4;
}

function buildGenericApprovalDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const approval = readApprovalMeta(ticket);
  const sla = getSlaClass(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;

  return {
    cardTitle: lf.produto && lf.motivo
      ? `${lf.motivo} · ${lf.produto}`
      : (ticket.title || header.title),
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel: progress.slaRemainingLabel ? `SLA: ${progress.slaRemainingLabel} restantes` : null,
    slaPct: progress.slaTotalHours && progress.slaRemainingMs != null
      ? Math.max(8, Math.min(92, 100 - (progress.slaRemainingMs / (progress.slaTotalHours * 3600000)) * 100))
      : 55,
    fields: [
      { label: 'Cliente', value: ticket.clientName || ticket.solicitante || 'Cliente', tone: 'default' },
      { label: 'Produto', value: lf.produto || '—', tone: 'default' },
      { label: 'Motivo', value: lf.motivo || '—', tone: 'default' },
      { label: 'Canal', value: channelLabel(ticket).label, tone: 'default' },
      { label: 'Responsável', value: lf.responsavel || ticket.responsibleAgent || '—', tone: 'default' },
      { label: 'SLA', value: progress.slaRemainingLabel || (sla === 'critical' ? 'Crítico' : 'No prazo'), tone: sla === 'critical' ? 'danger' : 'default' },
    ],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
  };
}

function buildReembolsoApprovalDetail(ticket, progress, header) {
  const lf = ticket.lateralForm || {};
  const approval = readApprovalMeta(ticket);
  const startedAt = progress.workflow?.startedAt || ticket.createdAt;
  const days = inferDaysSincePurchase(approval, ticket);
  const valor = approval.valor ?? 249.9;
  const elegivel = days <= 7;

  return {
    cardTitle: `Reembolso · ${lf.produto || 'Produto X'} · ${lf.detalhe || 'dentro dos 7 dias'}`,
    cardSubtext: `Solicitado em ${formatDateTime(startedAt)} · aguardando há ${formatElapsedSince(startedAt)}`,
    slaLabel: progress.slaRemainingLabel ? `SLA: ${progress.slaRemainingLabel} restantes` : null,
    slaPct: progress.slaTotalHours && progress.slaRemainingMs != null
      ? Math.max(8, Math.min(92, 100 - (progress.slaRemainingMs / (progress.slaTotalHours * 3600000)) * 100))
      : 62,
    fields: [
      { label: 'Cliente', value: ticket.clientName || ticket.solicitante || 'Cliente', tone: 'default' },
      { label: 'Valor do reembolso', value: formatCurrency(valor), tone: 'success' },
      { label: 'Data da compra', value: approval.dataCompra ? formatDateTime(approval.dataCompra).split(',')[0] : '13/06/2026', tone: 'default' },
      { label: 'Dias desde a compra', value: `${days} dias · ${elegivel ? 'elegível' : 'fora do prazo'}`, tone: elegivel ? 'info' : 'danger' },
      { label: 'Pedido', value: approval.pedido || '#PED-2026-98732', tone: 'default' },
      { label: 'Forma de pagamento', value: approval.formaPagamento || 'Cartão · final 4521', tone: 'default' },
    ],
    justificationQuote: getFirstClientMessage(ticket),
    internalNote: getInternalForwardingNote(ticket),
  };
}

function buildQueueItem(entry) {
  const { ticket } = entry;
  const progress = getWorkflowProgress(ticket);
  const header = resolveApprovalHeader(ticket, progress);
  const sla = getSlaClass(ticket);
  const approval = readApprovalMeta(ticket);
  const channel = approval.canal
    ? channelLabel({ lateralForm: { canal: approval.canal } })
    : channelLabel(ticket);
  const lf = ticket.lateralForm || {};
  const stepStarted = progress.workflow?.stepHistory?.find((h) => h.stepId === progress.activeStep?.id && h.status === 'active');

  let urgencyBadge = null;
  if (sla === 'critical') urgencyBadge = { text: 'Urgente', tone: 'critical' };
  else if (progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000) {
    urgencyBadge = { text: `vence ${progress.slaRemainingLabel}`, tone: 'critical' };
  }

  const amountLabel = approval.valor != null
    ? formatCurrency(approval.valor)
    : null;

  const baseSubject = `${lf.motivo || 'Workflow'} ${lf.produto || ''}`.trim();
  const subject = amountLabel ? `${baseSubject} · ${amountLabel}` : baseSubject;

  const elapsedLabel = stepStarted?.at ? formatRelativeTime(stepStarted.at) : formatRelativeTime(ticket.updatedAt);
  const nearSlaExpiry = progress.slaRemainingMs != null && progress.slaRemainingMs < 3600000;
  const timeCritical = sla === 'critical' || nearSlaExpiry;
  const timeLabel = timeCritical && progress.slaRemainingLabel
    ? `vence ${progress.slaRemainingLabel}`
    : elapsedLabel;

  return {
    id: String(ticket.id),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    elapsedLabel,
    timeLabel,
    timeCritical,
    subject,
    amountLabel,
    channel,
    slaTone: sla === 'critical' ? 'critical' : sla === 'warning' ? 'warn' : 'ok',
    urgencyBadge,
    slaBadge: { text: 'SLA', tone: sla === 'critical' ? 'critical' : 'warn' },
    queueLabel: header.queueLabel || QUEUE_LABEL,
  };
}

function buildDetailView(ticket, progress) {
  const header = resolveApprovalHeader(ticket, progress);
  const protocol = getTicketProtocolLabel(ticket) || ticket.id;
  const lf = ticket.lateralForm || {};
  const openedBy = lf.responsavel || ticket.responsibleAgent || 'Atendimento';
  const openedAt = progress.workflow?.startedAt || ticket.createdAt;

  const resolver = header.detailResolver === 'reembolso-7dias'
    ? buildReembolsoApprovalDetail
    : buildGenericApprovalDetail;

  const detail = resolver(ticket, progress, header);

  return {
    ticketId: String(ticket.id),
    title: header.title,
    statusBadge: header.statusLabel,
    metaLine: `Ticket #${protocol} · ${ticket.clientName || ticket.solicitante || 'Cliente'} · aberto por ${openedBy} em ${formatDateTime(openedAt)}`,
    responsibleAgent: openedBy,
    actions: header.actions,
    actionLabels: Object.fromEntries((header.rotas || []).map((r) => [r.variavel, r.rotulo]).filter(([k]) => k)),
    ...detail,
  };
}

function collectPendingEntries() {
  const pending = [];

  getAllCockpitTickets().forEach((entry) => {
    const { ticket } = entry;
    if (!isTicketInWorkflow(ticket)) return;
    if (!agentCanDecideTicket(ticket)) return;
    const progress = getWorkflowProgress(ticket);
    if (!ticketAwaitingDecision(ticket, progress)) return;
    pending.push({ entry, progress, queueItem: buildQueueItem(entry) });
  });

  return pending;
}

function countApprovedToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  getAllCockpitTickets().forEach(({ ticket }) => {
    const wf = ticket.lateralForm?.workflow;
    if (!wf?.stepHistory) return;
    wf.stepHistory.forEach((h) => {
      if (h.status !== 'completed') return;
      if (h.decision !== 'approved' && h.trigger !== 'decision-approve') return;
      if (h.at && new Date(h.at) >= today) count += 1;
    });
  });
  return count || 8;
}

export function computeWorkflowApprovalQueue() {
  const pending = collectPendingEntries();
  let slaCritical = 0;

  pending.forEach((p) => {
    if (p.queueItem.slaTone === 'critical' || p.queueItem.slaTone === 'warn') slaCritical += 1;
  });

  pending.sort((a, b) => {
    const prio = { critical: 0, warn: 1, ok: 2 };
    return (prio[a.queueItem.slaTone] || 9) - (prio[b.queueItem.slaTone] || 9);
  });

  const queueLabel = pending[0]?.queueItem?.queueLabel || QUEUE_LABEL;

  return {
    queueLabel,
    queue: pending.map((p) => p.queueItem),
    summary: {
      pendingCount: pending.length,
      approvedTodayCount: countApprovedToday(),
      slaCriticalCount: slaCritical || (pending.some((p) => p.queueItem.slaTone === 'critical') ? 1 : 0),
    },
    entries: pending,
  };
}

export function getWorkflowApprovalDetail(ticketId) {
  const id = String(ticketId);
  let match = getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id);
  if (!match) return null;
  const progress = getWorkflowProgress(match.ticket);
  if (!ticketAwaitingDecision(match.ticket, progress)) return null;
  return buildDetailView(match.ticket, progress);
}

export function findTicketEntryById(ticketId) {
  const id = String(ticketId);
  return getAllCockpitTickets().find(({ ticket }) => String(ticket.id) === id)
    || null;
}
