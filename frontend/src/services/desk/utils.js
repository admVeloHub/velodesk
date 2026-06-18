/**
 * Desk CRM — utilitários de fila e conversa
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import { getKanbanColumns, saveKanbanColumns, getAllCockpitTickets } from '../kanbanStorage';
import { lookupClient, getAgentName } from '../clientDb';

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getInitials(name) {
  const parts = String(name || '??').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name || '?').slice(0, 2).toUpperCase();
}

export function normalizeCpf(v) {
  return String(v || '').replace(/\D/g, '');
}

export function formatCpf(digits) {
  const d = normalizeCpf(digits);
  if (d.length !== 11) return digits;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatMsgMeta(iso, author) {
  if (!iso) return author || '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
    (author ? ' · ' + author : '');
}

export function getSlaClass(ticket) {
  if (ticket.slaStatus === 'critical') return 'critical';
  if (ticket.slaStatus === 'warning' || ticket.slaStatus === 'attention') return 'warning';
  if (ticket.slaRemaining != null) {
    if (ticket.slaRemaining <= 0) return 'critical';
    if (ticket.slaRemaining <= 30) return 'warning';
  }
  return 'ok';
}

function ensureTicketSlaFields(ticket) {
  if (ticket.slaRemaining == null) ticket.slaRemaining = 120;
  if (!ticket.slaStatus) ticket.slaStatus = 'ok';
}

export function normalizeTicketForDeskV2(ticket) {
  if (!ticket) return ticket;
  if (!ticket.lateralForm) ticket.lateralForm = {};

  const cpfDigits = normalizeCpf(ticket.lateralForm.cpf || ticket.clientCPF);
  if (cpfDigits && !ticket.lateralForm.cpf) ticket.lateralForm.cpf = cpfDigits;
  if (cpfDigits && !ticket.clientCPF) ticket.clientCPF = formatCpf(cpfDigits);

  const client = lookupClient(cpfDigits);
  ticket.clientName = ticket.clientName || ticket.solicitante || (client && client.name) || 'Cliente';
  ticket.solicitante = ticket.solicitante || ticket.clientName;

  if (!ticket.lateralForm.canal) ticket.lateralForm.canal = ticket.channel || ticket.source || 'WhatsApp';
  if (!ticket.lateralForm.classificacaoTipo) ticket.lateralForm.classificacaoTipo = 'Solicitação';
  if (!ticket.lateralForm.produto) ticket.lateralForm.produto = (client && client.produtos && client.produtos[0]) || 'Internet Fibra';
  if (!ticket.lateralForm.motivo) ticket.lateralForm.motivo = 'Em análise';
  if (!ticket.lateralForm.responsavel) ticket.lateralForm.responsavel = ticket.responsibleAgent || getAgentName();

  ensureTicketSlaFields(ticket);

  if (!ticket.messages || !ticket.messages.length) {
    const created = ticket.createdAt || new Date().toISOString();
    ticket.messages = [{
      fromClient: true,
      type: 'client',
      text: ticket.description || ticket.title || 'Solicitação do cliente.',
      timestamp: created,
      author: ticket.clientName
    }];
  }

  if (!ticket.updatedAt) ticket.updatedAt = ticket.createdAt || new Date().toISOString();
  if (!ticket.createdAt) ticket.createdAt = ticket.updatedAt;
  return ticket;
}

export function migrateAllTicketsForDeskV2() {
  const columns = getKanbanColumns();
  if (!columns.length) return;
  let changed = false;
  columns.forEach((box) => {
    (box.tickets || []).forEach((t) => {
      const before = JSON.stringify(t);
      normalizeTicketForDeskV2(t);
      if (JSON.stringify(t) !== before) changed = true;
    });
  });
  if (changed) saveKanbanColumns(columns);
}

export function filterTickets(activeQueue, searchQuery, activeSort) {
  const q = (searchQuery || '').toLowerCase();
  return getAllCockpitTickets()
    .filter((entry) => {
      if (entry.queueId !== activeQueue) return false;
      if (!q) return true;
      const t = entry.ticket;
      const hay = [t.id, t.title, t.description, t.clientName, t.solicitante].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    })
    .sort((a, b) => {
      if (activeSort === 'prioridade') {
        const prio = { critica: 0, alta: 1, normal: 2, baixa: 3 };
        return (prio[a.ticket.priority] || 9) - (prio[b.ticket.priority] || 9);
      }
      if (activeSort === 'sla') {
        return (a.ticket.slaRemaining || 999) - (b.ticket.slaRemaining || 999);
      }
      return new Date(b.ticket.updatedAt || 0) - new Date(a.ticket.updatedAt || 0);
    });
}

export function countByQueue(queueId) {
  return getAllCockpitTickets().filter((e) => e.queueId === queueId).length;
}

export function pickDefaultTicket(activeQueue) {
  const list = filterTickets(activeQueue || 'em-andamento', '', 'data');
  return list.length ? list[0].ticket.id : null;
}

export function buildConversationMessages(ticket) {
  const msgs = [];
  const created = ticket.createdAt || new Date().toISOString();
  msgs.push({
    type: 'system',
    text: 'Ticket #' + ticket.id + ' criado — ' + (ticket.title || 'Sem título'),
    meta: formatMsgMeta(created, 'Sistema')
  });
  (ticket.messages || []).forEach((m) => {
    if (m.type === 'system') return;
    const isClient = m.fromClient || m.type === 'client';
    msgs.push({
      type: isClient ? 'client' : 'agent',
      initials: isClient ? getInitials(ticket.clientName || m.author) : getInitials(getAgentName()),
      text: m.text || m.message || '',
      meta: formatMsgMeta(m.timestamp || m.createdAt, m.author || (isClient ? ticket.clientName : getAgentName()))
    });
  });
  return msgs;
}

export { getAgentName };
