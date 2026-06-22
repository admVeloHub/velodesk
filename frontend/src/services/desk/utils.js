/**
 * Desk CRM — utilitários de fila e conversa
 * VERSION: v2.1.0 | DATE: 2026-06-19
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
  return {
    name: ticket.clientName || ticket.solicitante || client?.name || '',
    cpf: formatCpf(ticket.lateralForm?.cpf || ticket.clientCPF || client?.cpf || ''),
    email: client?.email || ticket.clientEmail || '',
    phone: client?.telefone || ticket.clientPhone || '',
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
  const tipo = fields?.tipo || lf.classificacaoTipo || 'Solicitação';
  const produto = fields?.produto || lf.produto || 'Produto';
  const motivo = fields?.motivo || lf.motivo || 'Motivo';
  const detalhe = lf.detalhe || 'Em análise';
  return `${tipo} → ${produto} → ${motivo} → ${detalhe}`;
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
      const tCpf = normalizeCpf(t.lateralForm?.cpf || t.clientCPF || '');
      return tCpf === digits;
    });
    return sortTicketEntries(byCpf, activeSort);
  }

  const idQuery = trimmed.replace(/^#/, '').trim();
  const idDigits = digits;

  if (idDigits.length >= 4) {
    const exact = all.filter(({ ticket: t }) => String(t.id) === idQuery || String(t.id) === idDigits);
    if (exact.length) return sortTicketEntries(exact, activeSort);

    const partial = all.filter(({ ticket: t }) => String(t.id).includes(idDigits));
    if (partial.length) return sortTicketEntries(partial, activeSort);
  }

  if (idQuery.length >= 3) {
    const loose = all.filter(({ ticket: t }) => {
      const hay = [t.id, t.title, t.clientName, t.solicitante].join(' ').toLowerCase();
      return hay.includes(idQuery.toLowerCase());
    });
    if (loose.length) return sortTicketEntries(loose, activeSort);
  }

  return [];
}

export function countByQueue(queueId) {
  return getAllCockpitTickets().filter((e) => e.queueId === queueId).length;
}

export function pickDefaultTicket(activeQueue) {
  const all = getAllCockpitTickets();
  const preferred = all.find((e) =>
    e.queueId === 'em-andamento' && (e.ticket.clientName || '').indexOf('João Pereira') >= 0
  ) || all.find((e) =>
    e.queueId === 'em-andamento' && (e.ticket.clientName || '').indexOf('Maria') >= 0
  );
  if (preferred) return preferred.ticket.id;
  const list = filterTickets(activeQueue || 'em-andamento', '', 'data');
  return list.length ? list[0].ticket.id : (all[0]?.ticket?.id ?? null);
}

export function buildConversationMessages(ticket) {
  const msgs = [];
  const created = ticket.createdAt || new Date().toISOString();
  msgs.push({
    type: 'system',
    text: 'Ticket #' + ticket.id + ' criado — ' + (ticket.title || 'Sem título'),
    meta: formatMsgMeta(created, 'Sistema'),
    timestamp: created,
  });
  (ticket.messages || []).forEach((m) => {
    if (m.type === 'system') return;
    const isClient = m.fromClient || m.type === 'client';
    const ts = m.timestamp || m.createdAt;
    msgs.push({
      type: isClient ? 'client' : 'agent',
      initials: isClient ? getInitials(ticket.clientName || m.author) : getInitials(getAgentName()),
      text: m.text || m.message || '',
      meta: formatMsgMeta(ts, m.author || (isClient ? ticket.clientName : getAgentName())),
      timestamp: ts,
    });
  });
  return msgs;
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

function todayAt(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
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

function mapStoredInternalNote(note, ticket) {
  const kind = note.kind || 'agent';
  return {
    id: note.id || `note-${ticket.id}-${note.timestamp || Date.now()}`,
    kind,
    author: note.author || note.agent || getAgentName(),
    initials: note.initials || getInitials(note.author || getAgentName()),
    badge: note.badge || (kind === 'ai' ? 'Automática' : kind === 'system' ? 'Automático' : kind === 'sla' ? 'Atenção' : 'Interna'),
    timestamp: note.timestamp || note.createdAt || ticket.updatedAt,
    body: note.text || note.body || '',
    tags: note.tags || [],
    editable: kind === 'agent',
    ticketId: String(ticket.id),
    ticketTitle: getTicketTitle(ticket),
    boldSegments: note.boldSegments || [],
  };
}

function buildSyntheticInternalNotes(ticket) {
  const notes = [];
  const created = ticket.createdAt || new Date().toISOString();
  const agent = ticket.responsibleAgent || ticket.lateralForm?.responsavel || getAgentName();
  const lf = ticket.lateralForm || {};
  const canal = lf.canal || ticket.channel || ticket.source || 'WhatsApp';
  const tipo = lf.classificacaoTipo || 'Solicitação';
  const produto = lf.produto || 'Internet Fibra';
  const motivo = lf.motivo || 'Em análise';
  const createdTime = new Date(created);

  notes.push({
    id: `sys-${ticket.id}`,
    kind: 'system',
    author: 'Sistema',
    badge: 'Automático',
    timestamp: created,
    body: `Ticket criado via ${canal}. Tabulação aplicada automaticamente: ${tipo} → ${produto} → ${motivo}. Agente responsável: ${agent}.`,
    ticketId: String(ticket.id),
    ticketTitle: getTicketTitle(ticket),
  });

  const titleLower = String(ticket.title || '').toLowerCase();
  const motivoLower = String(motivo).toLowerCase();
  if (motivoLower.includes('lentid') || titleLower.includes('lentid')) {
    notes.push({
      id: `ai-${ticket.id}`,
      kind: 'ai',
      author: 'IA Revisor',
      badge: 'Automática',
      timestamp: new Date(createdTime.getTime() + 7 * 60000).toISOString(),
      body: 'Análise automática: velocidade reportada (50MB) representa 10% do contrato (500MB). Padrão compatível com congestionamento de backhaul noturno. Recomendado: verificar utilização de porta na OLT entre 21h–23h dos últimos 7 dias.',
      tags: ['Diagnóstico IA', 'Backhaul', 'Congestionamento'],
      ticketId: String(ticket.id),
      ticketTitle: getTicketTitle(ticket),
    });
  }

  if ((ticket.clientName || '').indexOf('Maria Oliveira') >= 0) {
    notes.push({
      id: `agent-maria-${ticket.id}`,
      kind: 'agent',
      author: 'Ana Silva',
      initials: 'AS',
      badge: 'Interna',
      timestamp: todayAt(9, 28),
      body: 'Cliente reporta lentidão noturna recorrente. Verificar se há outros chamados abertos na mesma OLT — região do bairro Jardim América. Caso confirmado, abrir incidente coletivo e acionar N2 de redes.',
      tags: ['OLT', 'Incidente coletivo', 'N2'],
      editable: true,
      ticketId: String(ticket.id),
      ticketTitle: getTicketTitle(ticket),
    });
  }

  ensureTicketSlaFields(ticket);
  const slaClass = getSlaClass(ticket);
  if (slaClass === 'warning' || slaClass === 'critical') {
    const limitHours = String(ticket.priority || '').toLowerCase().includes('crit') ? 4 : 4;
    const deadline = new Date(createdTime.getTime() + limitHours * 3600000);
    const remainingMin = Math.max(0, ticket.slaRemaining || 0);
    const h = Math.floor(remainingMin / 60);
    const m = remainingMin % 60;
    const deadlineLabel = deadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const remainingLabel = `${h}h ${String(m).padStart(2, '0')}min`;
    notes.push({
      id: `sla-${ticket.id}`,
      kind: 'sla',
      author: 'Alerta SLA',
      badge: 'Atenção',
      timestamp: todayAt(11, 21),
      body: `Este ticket completa 2h sem resolução em ${deadlineLabel}. O SLA contratado para reclamações de internet é de 4h. Restam ${remainingLabel} para vencimento.`,
      boldSegments: [deadlineLabel, remainingLabel],
      ticketId: String(ticket.id),
      ticketTitle: getTicketTitle(ticket),
    });
  }

  return notes;
}

export function buildClientInternalNotesFeed(ticket, client) {
  if (!ticket) return [];

  const contact = getClientContactFields(ticket, client);
  const cpfDigits = normalizeCpf(ticket.lateralForm?.cpf || ticket.clientCPF || client?.cpf || '');
  const clientTickets = collectClientTickets(cpfDigits, contact.name);
  const tickets = clientTickets.length ? clientTickets : [ticket];
  const merged = [];
  const seen = new Set();

  tickets.forEach((t) => {
    normalizeTicketForDeskV2(t);
    (t.internalNotes || []).forEach((note) => {
      const mapped = mapStoredInternalNote(note, t);
      if (seen.has(mapped.id)) return;
      seen.add(mapped.id);
      merged.push(mapped);
    });
    buildSyntheticInternalNotes(t).forEach((note) => {
      if (seen.has(note.id)) return;
      seen.add(note.id);
      merged.push(note);
    });
  });

  merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return merged;
}

export function applySendStatus(entry, queueId) {
  const statusMap = {
    'em-andamento': { box: 'em-andamento', status: 'em-aberto' },
    pendente: { box: 'em-espera', status: 'pendente' },
    resolvidos: { box: 'resolvidos', status: 'resolvido' },
  };
  const cfg = statusMap[queueId] || statusMap['em-andamento'];
  entry.ticket.status = cfg.status;
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
