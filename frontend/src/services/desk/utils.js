/**
 * Desk CRM — utilitários de fila e conversa
 * VERSION: v2.10.0 | DATE: 2026-07-07
 */
import { getKanbanColumns, saveKanbanColumns, getAllCockpitTickets } from '../kanbanStorage';
import { ticketMatchesAgentResponsavel } from './responsavelSegmentation';
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

/** Número de protocolo visível (sem #, sem fallback de _id) */
export function getTicketProtocolLabel(ticket) {
  return String(ticket?.chamadoProtocolo || '').trim();
}

/** Máscara CPF enquanto digita (máx. 11 dígitos): 000.000.000-00 */
export function maskCpfInput(value) {
  const d = normalizeCpf(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCpf(digits) {
  const d = normalizeCpf(digits);
  if (d.length !== 11) return maskCpfInput(d);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function isValidCpfDigits(value) {
  return normalizeCpf(value).length === 11;
}

/** Exige formato mínimo local@dominio.ext (pelo menos um ponto após @) */
export function isValidEmailFormat(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function formatMsgMeta(iso, author) {
  if (!iso) return author || '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
    (author ? ' · ' + author : '');
}

export function formatWaTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatWaDateSeparator(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTicketDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function getTicketTitle(ticket) {
  return ticket?.title || ticket?.description || 'Sem assunto';
}

export function statusMeta(queueId) {
  const map = {
    'em-andamento': { label: 'Em andamento', cls: 'andamento' },
    novos: { label: 'Novo', cls: 'novo' },
    pendente: { label: 'Pendente', cls: 'pendente' },
    resolvidos: { label: 'Resolvido', cls: 'resolvido' },
  };
  return map[queueId] || { label: 'Em andamento', cls: 'andamento' };
}

export function buildTags(ticket) {
  const tags = [];
  const lf = ticket.lateralForm || {};
  if (lf.produto) tags.push(lf.produto.replace(/Internet\s+/i, '').trim() || lf.produto);
  if (lf.motivo) tags.push(lf.motivo);
  if (!tags.length && ticket.priority) tags.push(ticket.priority);
  return tags.slice(0, 3);
}

export function getClientContactFields(ticket, client) {
  const lf = ticket?.lateralForm || {};
  const emails = lf.clienteEmail;
  const phones = lf.clienteTelefone;
  const emailFromLf = Array.isArray(emails) ? emails[0] : emails?.lista?.[0];
  const phoneFromLf = Array.isArray(phones) ? phones[0] : phones?.lista?.[0];
  return {
    name: lf.clienteNome || ticket?.clientName || ticket?.solicitante || client?.name || '',
    cpf: formatCpf(lf.clienteCpf || lf.cpf || ticket?.clientCPF || client?.cpf || ''),
    email: emailFromLf || ticket?.clientEmail || client?.email || '',
    phone: phoneFromLf || ticket?.clientPhone || client?.telefone || '',
  };
}

export function getProductTagClass(product) {
  const lower = String(product || '').toLowerCase();
  if (lower.indexOf('móvel') >= 0 || lower.indexOf('movel') >= 0) return 'velo-tag--mobile';
  if (lower.indexOf('combo') >= 0) return 'velo-tag--combo';
  if (lower.indexOf('fibra') >= 0 || lower.indexOf('internet') >= 0) return 'velo-tag--fiber';
  if (lower.indexOf('tv') >= 0) return 'velo-tag--tv';
  if (lower.indexOf('fixo') >= 0 || lower.indexOf('telefone') >= 0) return 'velo-tag--landline';
  if (lower.indexOf('streaming') >= 0) return 'velo-tag--streaming';
  return 'velo-tag--default';
}

export function getClientProducts(ticket, client) {
  const products = client?.produtos ? [...client.produtos] : [];
  const prod = ticket.lateralForm?.produto || '';
  if (prod && products.indexOf(prod) < 0) products.unshift(prod);
  if (!products.length && prod) return [prod];
  return products;
}

export function buildIaReply(ticket) {
  const lf = ticket.lateralForm || {};
  const name = (ticket.clientName || 'cliente').split(' ')[0];
  return `Olá ${name}! Entendo sua solicitação sobre ${lf.motivo || ticket.title || 'seu atendimento'}. Vou verificar agora e retorno em instantes com a melhor solução.`;
}

export function buildIaTabulation(ticket, fields) {
  const lf = ticket?.lateralForm || {};
  const tipo = fields?.tipo || lf.classificacaoTipo || '';
  const produto = fields?.produto || lf.produto || '';
  const motivo = fields?.motivo || lf.motivo || '';
  const detalhe = fields?.detalhe || lf.detalhe || '';
  const parts = [tipo, produto, motivo, detalhe].filter(Boolean);
  return parts.length ? parts.join(' → ') : 'Tabulação incompleta';
}

export function getEscalonarLabel(id) {
  const map = { n2: 'N2', financeiro: 'Financeiro', suporte: 'Suporte' };
  return map[id] || 'Selecionar escalonamento';
}

export const TICKET_OPERATION_STEPS = [
  { id: 1, title: 'Caixa de entrada e atendimento N1', subtitle: 'N1', icon: 'ti-inbox' },
  { id: 2, title: 'Workflow', subtitle: 'Workflow', icon: 'ti-arrows-exchange' },
  { id: 3, title: 'Retorno ao atendimento N1', subtitle: 'Finalização', icon: 'ti-home' },
];

function resolveWorkflowArea(escalonar, group, lastWorkflow) {
  if (escalonar === 'n2' || lastWorkflow === 'n2' || group.includes('n2')) return 'N2';
  if (escalonar === 'financeiro' || lastWorkflow === 'financeiro' || group.includes('financeiro')) {
    return 'Financeiro';
  }
  if (escalonar === 'suporte' || lastWorkflow === 'suporte' || group.includes('suporte')) {
    return 'Suporte';
  }
  return null;
}

export function getTicketOperationProgress(ticket, queueId, liveEscalonar) {
  const lf = ticket?.lateralForm || {};
  const escalonar = liveEscalonar !== undefined ? liveEscalonar : lf.escalonar;
  const group = String(ticket?.group || '').toLowerCase();
  const resolved = queueId === 'resolvidos' || ticket?.status === 'resolvido';
  const workflowArea = resolveWorkflowArea(escalonar, group, lf.lastWorkflow);
  const inWorkflow = Boolean(escalonar);
  const retornoN1 = lf.retornoN1 === true || (lf.wasEscalated && !escalonar && !resolved);

  let activeStep = 1;
  if (resolved) {
    activeStep = 4;
  } else if (inWorkflow) {
    activeStep = 2;
  } else if (retornoN1) {
    activeStep = 3;
  } else if (queueId === 'novos' || ticket?.status === 'novo') {
    activeStep = 1;
  }

  return {
    activeStep,
    workflowArea,
    resolved,
    steps: TICKET_OPERATION_STEPS,
  };
}

export function getTicketOperationAreaLabel(ticket) {
  const { activeStep, workflowArea } = getTicketOperationProgress(ticket);
  if (activeStep >= 4) return 'Finalizado';
  if (activeStep === 2 && workflowArea) return workflowArea;
  if (activeStep === 3) return 'N1 — Finalização';
  return 'N1';
}

export function getCascadeCategoryLabel(id) {
  const map = {
    'emprestimo-pessoal': 'Empréstimo pessoal',
    antecipacao: 'Antecipação',
    'alteracao-dados': 'Alteração de dados',
  };
  return map[id] || 'Selecionar categoria';
}

export function getCascadeActionLabel(id) {
  const map = { cancelamento: 'Cancelamento', estorno: 'Estorno' };
  return map[id] || 'Selecionar ação';
}

function ensureTicketSlaFields(ticket) {
  if (ticket.slaRemaining != null && ticket.slaStatus) return;
  const priority = String(ticket.priority || '').toLowerCase();
  const limitHours = priority === 'critica' || priority === 'critical' ? 4
    : priority === 'alta' || priority === 'high' ? 8 : 24;
  const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : Date.now();
  const elapsedMin = Math.max(0, Math.round((Date.now() - created) / 60000));
  const totalMin = limitHours * 60;
  ticket.slaRemaining = totalMin - elapsedMin;
  if (ticket.slaRemaining <= 0) ticket.slaStatus = 'critical';
  else if (ticket.slaRemaining <= Math.min(60, totalMin * 0.2)) ticket.slaStatus = 'warning';
  else ticket.slaStatus = 'ok';
}

export function getSlaClass(ticket) {
  ensureTicketSlaFields(ticket);
  if (ticket.slaStatus === 'critical') return 'critical';
  if (ticket.slaStatus === 'warning' || ticket.slaStatus === 'attention') return 'warning';
  if (ticket.slaRemaining != null) {
    if (ticket.slaRemaining <= 0) return 'critical';
    if (ticket.slaRemaining <= 30) return 'warning';
  }
  return 'ok';
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

  if (!ticket.lateralForm.canal && (ticket.channel || ticket.source)) {
    ticket.lateralForm.canal = ticket.channel || ticket.source;
  }
  if (!ticket.lateralForm.responsavel && ticket.responsibleAgent) {
    ticket.lateralForm.responsavel = ticket.responsibleAgent;
  }

  ensureTicketSlaFields(ticket);

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

export function sortTicketEntries(entries, activeSort) {
  return [...entries].sort((a, b) => {
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

export function filterTickets(activeQueue, searchQuery, activeSort) {
  const q = (searchQuery || '').toLowerCase();
  const filtered = getAllCockpitTickets()
    .filter((entry) => {
      if (entry.queueId !== activeQueue) return false;
      if (!ticketMatchesAgentResponsavel(entry.ticket)) return false;
      if (!q) return true;
      const t = entry.ticket;
      const cpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
      const hay = [t.id, t.title, t.description, t.clientName, t.solicitante, cpf, formatCpf(cpf)].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  return sortTicketEntries(filtered, activeSort);
}

/** Busca global por Enter: número do ticket ou todos os tickets do CPF. */
export function resolveDeskSearchEntries(rawQuery, activeSort) {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) return [];

  const digits = normalizeCpf(trimmed.replace(/^#/, ''));
  const all = getAllCockpitTickets();

  if (digits.length === 11) {
    const byCpf = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      const tCpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
      return tCpf === digits;
    });
    return sortTicketEntries(byCpf, activeSort);
  }

  const idQuery = trimmed.replace(/^#/, '').trim();
  const idDigits = digits;

  if (idDigits.length >= 4) {
    const exact = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      return String(t.id) === idQuery || String(t.id) === idDigits;
    });
    if (exact.length) return sortTicketEntries(exact, activeSort);

    const partial = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      return String(t.id).includes(idDigits);
    });
    if (partial.length) return sortTicketEntries(partial, activeSort);
  }

  if (idQuery.length >= 3) {
    const loose = all.filter(({ ticket: t }) => {
      if (!ticketMatchesAgentResponsavel(t)) return false;
      const hay = [t.id, t.title, t.clientName, t.solicitante].join(' ').toLowerCase();
      return hay.includes(idQuery.toLowerCase());
    });
    if (loose.length) return sortTicketEntries(loose, activeSort);
  }

  return [];
}

export function countByQueue(queueId) {
  return getAllCockpitTickets().filter((e) => e.queueId === queueId && ticketMatchesAgentResponsavel(e.ticket)).length;
}

export function pickDefaultTicket(activeQueue) {
  const list = filterTickets(activeQueue || 'em-andamento', '', 'data');
  if (list.length) return list[0].ticket.id;
  const all = getAllCockpitTickets();
  return all[0]?.ticket?.id ?? null;
}

export function isConversationMessage(message) {
  if (!message) return false;
  if (message.type === 'system' || message.type === 'internal') return false;
  const text = String(message.text || message.message || '').trim();
  if (!text) return false;
  return true;
}

export function isClientConversationMessage(message) {
  if (!isConversationMessage(message)) return false;
  if (message.fromClient === true || message.type === 'client') return true;
  if (message.type === 'agent') return false;
  return message.sender === 'them';
}

export function buildConversationMessages(ticket) {
  const msgs = [];
  (ticket.messages || []).forEach((m) => {
    if (!isConversationMessage(m)) return;
    const isClient = isClientConversationMessage(m);
    const ts = m.timestamp || m.time || m.createdAt;
    msgs.push({
      type: isClient ? 'client' : 'agent',
      initials: isClient ? getInitials(ticket.clientName || m.author) : getInitials(m.author || getAgentName()),
      text: String(m.text || m.message || '').trim(),
      meta: formatMsgMeta(ts, m.author || (isClient ? ticket.clientName : getAgentName())),
      timestamp: ts,
    });
  });
  return msgs;
}

function parseRegistroSortKey(id) {
  const match = String(id || '').match(/^(\d+)-(pub|int)$/);
  if (!match) return { index: 999999, part: 9 };
  return { index: Number(match[1]), part: match[2] === 'pub' ? 0 : 1 };
}

export function buildRegistroThread(ticket) {
  if (!ticket) return [];

  const raw = (ticket.messages || [])
    .filter((m) => {
      if (!m || m.type === 'system' || m.type === 'internal') return false;
      const text = String(m.text || m.message || '').trim();
      return Boolean(text);
    })
    .map((m) => ({ ...m, _kind: 'public' }));

  raw.sort((a, b) => {
    const tsA = new Date(a.timestamp || a.time || a.createdAt || 0).getTime();
    const tsB = new Date(b.timestamp || b.time || b.createdAt || 0).getTime();
    if (tsA !== tsB) return tsA - tsB;
    const keyA = parseRegistroSortKey(a.id);
    const keyB = parseRegistroSortKey(b.id);
    if (keyA.index !== keyB.index) return keyA.index - keyB.index;
    return keyA.part - keyB.part;
  });

  return raw.map((m) => {
    const origin = m.origin || (m.sender === 'them' ? 'cliente' : 'agente');
    const isClient = (
      origin === 'cliente'
      || m.fromClient === true
      || m.type === 'client'
      || m.sender === 'them'
    );
    const bubbleType = isClient ? 'client' : 'agent';
    const ts = m.timestamp || m.time || m.createdAt;
    const authorName = isClient
      ? (ticket.clientName || m.author)
      : (m.author || getAgentName());
    return {
      type: bubbleType,
      initials: getInitials(isClient ? ticket.clientName || m.author : authorName),
      text: String(m.text || m.message || '').trim(),
      meta: formatMsgMeta(ts, authorName),
      timestamp: ts,
    };
  });
}

export function getClientAnalise(client) {
  if (client?.analise) return client.analise;
  if ((client?.termometro ?? 0) >= 55 || client?.risco === 'Alto') {
    return 'Termômetro crítico: combinar financeiro + retenção no mesmo atendimento.';
  }
  if (client?.risco === 'Médio') {
    return 'Cliente requer acompanhamento proativo no atendimento.';
  }
  return 'Perfil estável — seguir fluxo padrão de atendimento.';
}

export function getTicketStatusLabel(status) {
  const map = {
    novo: 'Novo',
    'em-aberto': 'Em Andamento',
    'em-andamento': 'Em Andamento',
    pendente: 'Pendente',
    resolvido: 'Resolvido',
    resolvidos: 'Resolvido',
  };
  return map[status] || status || '—';
}

export function collectClientTickets(cpf, clientName) {
  const cpfDigits = normalizeCpf(cpf);
  const nameKey = (clientName || '').toLowerCase().trim();
  const seen = new Set();
  const list = [];

  getAllCockpitTickets().forEach(({ ticket: t }) => {
    const id = String(t.id || t._id);
    if (seen.has(id)) return;
    const tCpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
    const tName = (t.clientName || t.solicitante || '').toLowerCase();
    const titleMatch = nameKey && (t.title || '').toLowerCase().includes(nameKey);
    if ((cpfDigits && tCpf === cpfDigits) || (nameKey && (tName === nameKey || titleMatch))) {
      seen.add(id);
      list.push(t);
    }
  });

  list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  return list;
}

function isSameDay(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function formatInternalNoteTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(iso, new Date().toISOString())) return `hoje · ${time}`;
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${date} · ${time}`;
}

export function formatRegistroOccurrenceTimestamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

const ALTERACAO_FIELD_LABELS = {
  tipoChamado: 'Tipo',
  classificacaoTipo: 'Tipo',
  produto: 'Produto',
  motivo: 'Motivo',
  detalhe: 'Detalhe',
  responsavel: 'Responsável',
  atribuido: 'Atribuído',
  escalonar: 'Escalonar',
  status: 'Status',
};

const ALTERACAO_STATE_ALIASES = {
  classificacaoTipo: 'tipoChamado',
};

function normalizeAlteracaoStateKey(key) {
  return ALTERACAO_STATE_ALIASES[key] || key;
}

function extractAlteracaoFields(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const rows = [];
  Object.entries(raw).forEach(([key, value]) => {
    if (key === 'status') return;
    const display = String(value ?? '').trim();
    if (!display) return;
    rows.push({
      key: normalizeAlteracaoStateKey(key),
      field: ALTERACAO_FIELD_LABELS[key] || ALTERACAO_FIELD_LABELS[normalizeAlteracaoStateKey(key)] || key,
      value: display,
    });
  });
  return rows;
}

function applyAlteracoesToTabulationState(state, alteracoes) {
  (alteracoes || []).forEach((raw) => {
    extractAlteracaoFields(raw).forEach(({ key, value }) => {
      state[key] = value;
    });
  });
  return state;
}

function collectRegistroOccurrenceData(entry, previousTabulationState = {}, prevStatus = null) {
  const tabulationChanges = [];
  const seen = new Set();

  (entry.alteracoes || []).forEach((raw) => {
    extractAlteracaoFields(raw).forEach(({ key, field, value }) => {
      const prevVal = String(previousTabulationState[key] ?? '').trim();
      if (prevVal === value) return;
      const token = `${field}:${prevVal}->${value}`;
      if (seen.has(token)) return;
      seen.add(token);
      tabulationChanges.push({
        field,
        value,
        previousValue: prevVal || undefined,
      });
    });
  });

  const statusChanged = Boolean(
    entry.status
    && prevStatus !== null
    && String(entry.status) !== String(prevStatus)
  );
  const statusLabel = statusChanged ? getTicketStatusLabel(entry.status) : null;
  const previousStatusLabel = statusChanged && prevStatus
    ? getTicketStatusLabel(prevStatus)
    : null;

  return { tabulationChanges, statusLabel, previousStatusLabel, statusChanged };
}

function isAgentRegistroEntry(entry) {
  return String(entry.origin || 'agente').toLowerCase() !== 'cliente';
}

/** Supervisor: agente com anotação interna, diff de tabulação ou mudança de status */
function shouldShowSupervisorRegistroOccurrence(entry, previousTabulationState, prevStatus) {
  if (!isAgentRegistroEntry(entry)) return false;

  const hasInternal = Boolean(String(entry.anotacaoInterna ?? '').trim());
  const { tabulationChanges, statusChanged } = collectRegistroOccurrenceData(
    entry,
    previousTabulationState,
    prevStatus,
  );
  return hasInternal || tabulationChanges.length > 0 || statusChanged;
}

function mapSupervisorRegistroOccurrence(entry, ticket, client, previousTabulationState, prevStatus) {
  if (!shouldShowSupervisorRegistroOccurrence(entry, previousTabulationState, prevStatus)) return null;

  const ticketId = String(ticket.id || ticket._id);
  const author = resolveRegistroAutorLabel(entry, ticket, client);
  const {
    tabulationChanges,
    statusLabel,
    previousStatusLabel,
    statusChanged,
  } = collectRegistroOccurrenceData(entry, previousTabulationState, prevStatus);
  const internalExcerpt = String(entry.anotacaoInterna ?? '').trim();

  return {
    id: `${ticketId}:${entry.id}`,
    kind: 'registro',
    author,
    initials: getInitials(author),
    badge: 'Registro',
    timestamp: entry.time || entry.timestamp || ticket.updatedAt,
    tabulationChanges,
    statusLabel,
    previousStatusLabel,
    statusChanged,
    internalExcerpt,
    ticketId,
    ticketTitle: getTicketTitle(ticket),
  };
}

function isGenericRegistroAutorLabel(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'agente' || normalized === 'agent';
}

function resolveRegistroAutorLabel(entry, ticket, client) {
  const stored = String(entry.autor ?? entry.author ?? '').trim();
  if (stored && !isGenericRegistroAutorLabel(stored)) return stored;

  const origin = entry.origin || 'agente';
  if (origin === 'cliente') {
    return ticket?.clientName || ticket?.solicitante || client?.name || 'Cliente';
  }

  return '—';
}

function buildSupervisorRegistroFeed(ticket, client) {
  const merged = [];
  const seen = new Set();

  normalizeTicketForDeskV2(ticket);
  const historico = ticket.registroHistorico || ticket.registroAlteracoes || [];
  const tabulationState = {};
  let prevStatus = null;
  historico.forEach((entry) => {
    const previousTabulationState = { ...tabulationState };
    const mapped = mapSupervisorRegistroOccurrence(
      entry,
      ticket,
      client,
      previousTabulationState,
      prevStatus,
    );
    if (mapped && !seen.has(mapped.id)) {
      seen.add(mapped.id);
      merged.push(mapped);
    }
    applyAlteracoesToTabulationState(tabulationState, entry.alteracoes);
    if (entry.status) prevStatus = entry.status;
  });

  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return merged;
}

export function buildClientInternalNotesFeed(ticket, client) {
  if (!ticket) return [];
  return buildSupervisorRegistroFeed(ticket, client);
}

export function applySendStatus(entry, queueId) {
  const statusMap = {
    'em-andamento': { box: 'em-andamento', status: 'em-aberto' },
    pendente: { box: 'em-espera', status: 'pendente' },
    resolvidos: { box: 'resolvidos', status: 'resolvido' },
  };
  const cfg = statusMap[queueId] || statusMap['em-andamento'];
  entry.ticket.status = cfg.status;
  delete entry.ticket.boxId;
  moveTicketToBox(entry, cfg.box);
}

export function moveTicketToBox(entry, targetBoxId) {
  if (!entry || !targetBoxId) return;
  const columns = getKanbanColumns();
  const ticket = entry.ticket;
  const ticketId = String(ticket.id);
  columns.forEach((box) => {
    if (!box.tickets) return;
    box.tickets = box.tickets.filter((t) => String(t.id) !== ticketId && String(t._id) !== ticketId);
  });
  const target = columns.find((b) => b.id === targetBoxId);
  if (!target) return;
  if (!target.tickets) target.tickets = [];
  target.tickets.push(ticket);
  saveKanbanColumns(columns);
  entry.boxId = targetBoxId;
}

export { getAgentName };
