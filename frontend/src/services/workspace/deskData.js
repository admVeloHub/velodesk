/**
 * Workspace — dados operacionais do painel 360°
 * VERSION: v2.2.1 | DATE: 2026-07-14
 */
import { getAllCockpitTickets } from '../ticketsStorage';
import { getAgentName } from '../clientDb';
import { getSlaClass, isTicketInWorkflow, getWorkflowProgress } from '../desk/utils';
import { getWorkflowInfoRequests, resolveDeskTicketIdForInfoRequest } from '../workflow/workflowInfoNotifications';

function computeProductionWeek() {
  const mockCounts = [6, 7, 9, 5, 8, 3, 4];
  const now = new Date();
  const days = mockCounts.map((value, index) => {
    const offset = mockCounts.length - 1 - index;
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const isToday = offset === 0;
    const weekday = date
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', '')
      .replace(/^\w/, (c) => c.toUpperCase());
    const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return {
      id: date.toISOString().slice(0, 10),
      label: isToday ? 'Hoje' : `${weekday} ${dateLabel}`,
      value,
      isToday,
    };
  });
  const max = Math.max(...days.map((d) => d.value), 1);
  return days.map((day) => ({ ...day, pct: Math.round((day.value / max) * 100) }));
}

export function computeAgentDeskData() {
  const entries = getAllCockpitTickets();
  const agent = getAgentName();
  const counts = { novos: 0, emAndamento: 0, pendente: 0, resolvidos: 0, slaCritico: 0, aguardandoRetorno: 0 };

  const enriched = entries
    .filter((e) => e.queueId !== 'resolvidos')
    .map(({ ticket, queueId }) => {
      if (queueId === 'novos') counts.novos++;
      if (queueId === 'em-andamento') counts.emAndamento++;
      if (queueId === 'pendente') counts.pendente++;
      if (queueId === 'resolvidos') counts.resolvidos++;
      if (getSlaClass(ticket) === 'critical') counts.slaCritico++;
      if (queueId === 'pendente') counts.aguardandoRetorno++;
      return { ticket, queueId, sla: getSlaClass(ticket) };
    })
    .sort((a, b) => {
      const prio = { critical: 0, warning: 1, ok: 2 };
      return (prio[a.sla] || 9) - (prio[b.sla] || 9);
    });

  const nextAction = enriched[0] || null;

  return {
    agentName: agent,
    counts,
    enriched,
    nextAction,
    personal: { sla: 98, tma: '4m 12s', csat: '4.6' },
    hotClients: enriched.filter((e) => getSlaClass(e.ticket) !== 'ok').slice(0, 5)
  };
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `há ${h}h ${String(m).padStart(2, '0')}min` : `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function formatOpenDuration(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `aberto há ${h}h ${String(m).padStart(2, '0')}min`;
  return `aberto há ${min}min`;
}

function formatSlaLabel(ticket, sla) {
  getSlaClass(ticket);
  if (sla === 'critical' || (ticket.slaRemaining != null && ticket.slaRemaining <= 30)) {
    const remaining = Math.max(0, ticket.slaRemaining || 0);
    return `vence em ${remaining}min`;
  }
  if (ticket.slaRemaining != null) {
    const h = Math.floor(ticket.slaRemaining / 60);
    const m = ticket.slaRemaining % 60;
    if (h > 0) return `SLA ${h}h ${String(m).padStart(2, '0')}min`;
    return `SLA ${m}min`;
  }
  return 'SLA ok';
}

function channelIcon(channel) {
  const c = (channel || '').toLowerCase();
  if (c.includes('whats')) return 'fab fa-whatsapp';
  if (c.includes('mail') || c.includes('e-mail') || c.includes('email')) return 'fas fa-envelope';
  if (c.includes('phone') || c.includes('telefone') || c.includes('tel')) return 'fas fa-phone';
  if (c.includes('portal')) return 'fas fa-globe';
  return 'fas fa-comment';
}

function buildTags(ticket) {
  const tags = [];
  const lf = ticket.lateralForm || {};
  if (lf.produto) tags.push(lf.produto.replace(/^Internet\s+/i, '').split(' ')[0] || lf.produto);
  if (lf.motivo) tags.push(lf.motivo);
  if (ticket.group && /n2/i.test(ticket.group)) tags.push('N2');
  return tags.slice(0, 3);
}

export function mapEntryToRow(entry, sectionVariant) {
  const { ticket, queueId } = entry;
  const sla = getSlaClass(ticket);
  const channel = ticket.lateralForm?.canal || ticket.channel || ticket.source || '';
  const updatedAt = ticket.updatedAt || ticket.createdAt;

  let badge = { text: 'Em andamento', tone: 'workflow' };
  let accent = 'workflow';

  if (sectionVariant === 'urgent') {
    if (sla === 'critical' || sla === 'warning') {
      badge = { text: 'SLA crítico', tone: 'critical' };
      accent = 'critical';
    } else if (queueId === 'novos') {
      badge = { text: 'Novo', tone: 'new' };
      accent = 'new';
    }
  } else if (sectionVariant === 'replied') {
    badge = { text: 'Respondeu', tone: 'replied' };
    accent = 'replied';
  } else if (sectionVariant === 'workflow') {
    badge = { text: /n2/i.test(ticket.group || '') ? 'N2 respondeu' : 'Workflow', tone: 'workflow' };
    accent = 'workflow';
  }

  const slaTone = sla === 'critical' ? 'critical' : sla === 'warning' ? 'warn' : 'ok';
  const meta = queueId === 'novos' && ticket.createdAt
    ? formatOpenDuration(ticket.createdAt)
    : formatRelativeTime(updatedAt);

  return {
    id: String(ticket.id),
    initials: getInitials(ticket.clientName || ticket.solicitante),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    badge,
    subject: ticket.title || ticket.description || 'Sem assunto',
    channelIcon: channelIcon(channel),
    meta,
    slaLabel: formatSlaLabel(ticket, sla),
    slaTone,
    tags: buildTags(ticket),
    accent,
    unread: queueId === 'novos' || queueId === 'pendente',
  };
}

function mapInfoRequestToRow(request) {
  const excerpt = request.message.length > 96
    ? `${request.message.slice(0, 96).trim()}…`
    : request.message;

  return {
    id: resolveDeskTicketIdForInfoRequest(request),
    infoRequestId: request.id,
    initials: getInitials(request.clientName),
    clientName: request.clientName || 'Cliente',
    badge: { text: 'Pedido de info', tone: 'workflow' },
    subject: excerpt || request.ticketSubject || 'Solicitação de informação',
    channelIcon: 'ti ti-message-circle',
    meta: `Workflow · ${formatRelativeTime(request.createdAt)} · por ${request.requestedBy}`,
    slaLabel: request.stepLabel || 'Aguardando resposta',
    slaTone: 'warn',
    tags: ['Workflow'],
    accent: 'workflow',
    unread: !request.readAt,
    isWorkflowInfoRequest: true,
  };
}

function buildWorkflowSectionRows(workflowEntries) {
  const infoRequests = getWorkflowInfoRequests();
  const infoRows = infoRequests.map(mapInfoRequestToRow);
  const infoTicketIds = new Set(infoRows.map((row) => row.id));

  const workflowRows = workflowEntries
    .filter((entry) => !infoTicketIds.has(String(entry.ticket.id)))
    .slice(0, 5)
    .map((entry) => mapEntryToRow(entry, 'workflow'));

  const merged = [...infoRows, ...workflowRows].slice(0, 5);
  const unreadInfo = infoRows.filter((row) => row.unread).length;

  return {
    tickets: merged,
    count: workflowEntries.length + unreadInfo,
  };
}

function classifyEntry(entry) {
  const { queueId } = entry;
  const sla = getSlaClass(entry.ticket);
  if (queueId === 'pendente') return 'client-replied';
  if (queueId === 'em-andamento') return 'workflow';
  if (queueId === 'novos' || sla === 'critical' || sla === 'warning') return 'action-now';
  return null;
}

const SECTION_DEFS = [
  { id: 'action-now', title: 'Precisa de ação agora', icon: 'ti ti-alert-circle', variant: 'urgent' },
  { id: 'client-replied', title: 'Cliente respondeu', icon: 'ti ti-message-circle', variant: 'replied' },
  { id: 'workflow', title: 'Atualização interna / workflow', icon: 'ti ti-arrows-exchange', variant: 'workflow' },
];

export function computeAgent360View() {
  const desk = computeAgentDeskData();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const buckets = { 'action-now': [], 'client-replied': [], workflow: [] };
  desk.enriched.forEach((entry) => {
    const bucket = classifyEntry(entry);
    if (bucket && buckets[bucket]) buckets[bucket].push(entry);
  });

  const sections = SECTION_DEFS.map((def) => {
    if (def.id === 'workflow') {
      const workflowSection = buildWorkflowSectionRows(buckets.workflow || []);
      return { ...def, count: workflowSection.count, tickets: workflowSection.tickets };
    }

    const tickets = (buckets[def.id] || []).slice(0, 5).map((entry) => mapEntryToRow(entry, def.variant));
    return { ...def, count: (buckets[def.id] || []).length, tickets };
  });

  const criticalEntry = desk.enriched.find((e) => getSlaClass(e.ticket) === 'critical');
  let alert = null;
  if (criticalEntry) {
    const t = criticalEntry.ticket;
    getSlaClass(t);
    alert = {
      ticketId: String(t.id),
      clientName: t.clientName || t.solicitante || 'Cliente',
      subject: (t.title || '').split('—')[0].trim() || t.title || 'Ticket',
      expiresIn: `${Math.max(0, t.slaRemaining || 0)} minutos`,
    };
  }

  const assigned = desk.enriched.length;
  const resolvedToday = desk.counts.resolvidos || 0;

  return {
    greeting,
    agentName: desk.agentName || getAgentName() || 'agente',
    dateTimeLabel: `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${timeLabel}`,
    alert,
    kpis: [
      { id: 'assigned', label: 'Atribuídos a mim', value: String(assigned), hint: 'total', tone: 'neutral', icon: 'ti ti-ticket' },
      { id: 'resolved', label: 'Resolvidos hoje', value: String(resolvedToday), hint: resolvedToday > 0 ? `+${resolvedToday} hoje` : 'hoje', tone: 'success', icon: 'ti ti-circle-check' },
      { id: 'sla', label: 'SLA próximo do limite', value: String(desk.counts.slaCritico), hint: desk.counts.slaCritico > 0 ? 'atenção' : null, tone: desk.counts.slaCritico > 0 ? 'warn' : 'neutral', icon: 'ti ti-clock-exclamation' },
      { id: 'csat', label: 'CSAT médio', value: desk.personal.csat, hint: 'acima da meta', tone: 'success', icon: 'ti ti-star' },
      { id: 'tma', label: 'TMA hoje', value: desk.personal.tma, hint: '-8 min', tone: 'success', icon: 'ti ti-clock' },
    ],
    sections,
    productionWeek: computeProductionWeek(),
  };
}

export function computeSupervisorData() {
  return {
    online: 12,
    slaRisk: 5,
    slaPct: 90,
    tma: '4m 12s',
    tme: '6m 45s',
    nps: '72',
    volume: '1.247',
    warRoom: false,
  };
}

const FINANCEIRO_KW = ['financeiro', 'cobrança', 'cobranca', 'fatura', 'inadimplência', 'inadimplencia'];
const ESTORNO_KW = ['estorno', 'procon', 'devolução', 'devolucao'];

function classifyEscalationCategory(ticket) {
  const text = `${ticket?.title || ''} ${ticket?.description || ''} ${ticket?.lateralForm?.motivo || ''}`.toLowerCase();
  if (ESTORNO_KW.some((kw) => text.includes(kw))) return 'estorno';
  if (FINANCEIRO_KW.some((kw) => text.includes(kw))) return 'financeiro';
  return null;
}

/** Fallback local do Painel 360° Gestão quando a API não responde */
export function computeSupervisor360View() {
  const allEntries = getAllCockpitTickets();
  const entries = allEntries.filter((entry) => entry.queueId !== 'resolvidos');
  let slaRisk = 0;
  let slaCriticalCount = 0;

  entries.forEach(({ ticket }) => {
    const sla = getSlaClass(ticket);
    if (sla === 'critical' || sla === 'warning') slaRisk += 1;
    if (sla === 'critical') slaCriticalCount += 1;
  });

  const slaCriticalOnlyEntries = entries.filter(
    (entry) => getSlaClass(entry.ticket) === 'critical' && !classifyEscalationCategory(entry.ticket),
  );

  const categories = [
    { id: 'financeiro', label: 'Financeiro', count: 0, accent: 'orange' },
    { id: 'estorno', label: 'Estorno', count: 0, accent: 'navy' },
    { id: 'sla-critico', label: 'SLA crítico', count: slaCriticalOnlyEntries.length, accent: 'red' },
  ];
  const groupedEntries = {
    financeiro: [],
    estorno: [],
    'sla-critico': slaCriticalOnlyEntries.slice(0, 20).map((entry) => ({
      ticket: entry.ticket,
      queueId: entry.queueId,
      sla: getSlaClass(entry.ticket),
    })),
  };

  entries.forEach((entry) => {
    const categoryId = classifyEscalationCategory(entry.ticket);
    if (!categoryId) return;
    const category = categories.find((item) => item.id === categoryId);
    if (category) category.count += 1;
    if (groupedEntries[categoryId].length < 20) {
      groupedEntries[categoryId].push({
        ticket: entry.ticket,
        queueId: entry.queueId,
        sla: getSlaClass(entry.ticket),
      });
    }
  });

  const channelVision = ['whatsapp', 'email', 'telefone'].map((id) => {
    const inChannel = entries.filter(({ ticket }) => {
      const channel = String(ticket.channel || ticket.lateralForm?.canal || '').toLowerCase();
      if (id === 'whatsapp') return channel.includes('whats');
      if (id === 'email') return channel.includes('mail') || channel.includes('e-mail');
      return channel.includes('telefone') || channel.includes('phone');
    });
    const total = inChannel.length;
    const ok = inChannel.filter(({ ticket }) => getSlaClass(ticket) === 'ok').length;
    return {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      tickets: total,
      sla: total ? Math.round((ok / total) * 100) : 0,
      highVolume: false,
    };
  });

  const agentOf = (ticket) => String(ticket.responsibleAgent || ticket.lateralForm?.responsavel || 'Sem responsável').trim();

  const resolvedStats = new Map();
  allEntries
    .filter((entry) => entry.queueId === 'resolvidos')
    .forEach(({ ticket }) => {
      const agent = agentOf(ticket);
      resolvedStats.set(agent, (resolvedStats.get(agent) || 0) + 1);
    });

  const interactionStats = new Map();
  allEntries.forEach(({ ticket }) => {
    const agent = agentOf(ticket);
    interactionStats.set(agent, (interactionStats.get(agent) || 0) + 1);
  });

  const buildMockRanking = (statsMap, primaryLabel) => [...statsMap.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([agent, count], index) => ({
      id: `${primaryLabel}-${agent.replace(/\s+/g, '-')}`,
      rank: index + 1,
      name: agent,
      medal: index === 0,
      trend: 'up',
      sla: '90%',
      primaryValue: count,
      primaryLabel,
      tma: '—',
      csat: null,
      vsLastWeek: '—',
      shift: 'all',
      channel: 'all',
    }));

  const leaderboard = {
    resolvedRanking: buildMockRanking(resolvedStats, 'resolvidos'),
    interactionRanking: buildMockRanking(interactionStats, 'interações'),
  };

  return buildSupervisor360View({
    kpis: {
      slaPct: entries.length ? Math.max(0, 100 - Math.round((slaRisk / entries.length) * 100)) : 100,
      slaRisk,
      online: null,
      tma: '—',
      tme: '—',
      nps: null,
      volume: String(entries.length),
      warRoom: slaCriticalCount >= 3,
    },
    escalated: {
      categories,
      slaCriticalCount,
      groups: categories.map((category) => ({
        ...category,
        entries: groupedEntries[category.id] || [],
      })),
    },
    channelVision,
    leaderboard,
  });
}

export function computeManagementStats() {
  const entries = getAllCockpitTickets();
  const resolved = entries.filter((e) => e.queueId === 'resolvidos').length;
  return {
    volume: entries.length + 1200,
    tma: '4m 32s',
    fcr: '76%',
    forecast: '+18%',
    resolved
  };
}

export function computeWorkflow360View() {
  const entries = getAllCockpitTickets().filter(({ ticket }) => isTicketInWorkflow(ticket));
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  let slaCritical = 0;
  let awaitingExternal = 0;
  let completedToday = 0;

  const enriched = entries.map((entry) => {
    const { ticket } = entry;
    const sla = getSlaClass(ticket);
    if (sla === 'critical' || sla === 'warning') slaCritical++;
    const progress = getWorkflowProgress(ticket);
    if (progress?.awaitingTeamLabel) awaitingExternal++;
    if (progress?.workflow?.status === 'completed') completedToday++;
    return { ...entry, sla, progress };
  }).sort((a, b) => {
    const prio = { critical: 0, warning: 1, ok: 2 };
    return (prio[a.sla] || 9) - (prio[b.sla] || 9);
  });

  const activeRows = enriched
    .filter(({ progress }) => progress?.workflow?.status !== 'completed')
    .slice(0, 8)
    .map((entry) => mapEntryToRow(entry, 'workflow'));

  const externalRows = enriched
    .filter(({ progress }) => progress?.awaitingTeamLabel)
    .slice(0, 5)
    .map((entry) => mapEntryToRow(entry, 'workflow'));

  const sections = [
    {
      id: 'workflow-active',
      title: 'Fluxos em andamento',
      icon: 'ti ti-arrows-exchange',
      variant: 'workflow',
      count: enriched.filter(({ progress }) => progress?.workflow?.status !== 'completed').length,
      tickets: activeRows,
    },
    {
      id: 'workflow-external',
      title: 'Aguardando time externo',
      icon: 'ti ti-building-bank',
      variant: 'workflow',
      count: awaitingExternal,
      tickets: externalRows,
    },
  ];

  return {
    greeting,
    agentName: getAgentName() || 'operador',
    dateTimeLabel: `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${timeLabel}`,
    kpis: [
      { id: 'total', label: 'Em workflow', value: String(enriched.length), hint: 'ativos', tone: 'neutral', icon: 'ti ti-arrows-exchange' },
      { id: 'sla', label: 'SLA em risco', value: String(slaCritical), hint: slaCritical > 0 ? 'atenção' : null, tone: slaCritical > 0 ? 'warn' : 'neutral', icon: 'ti ti-clock-exclamation' },
      { id: 'external', label: 'Aguardando time', value: String(awaitingExternal), hint: 'externo', tone: awaitingExternal > 0 ? 'warn' : 'neutral', icon: 'ti ti-users' },
      { id: 'done', label: 'Concluídos hoje', value: String(completedToday), hint: 'workflow', tone: 'success', icon: 'ti ti-circle-check' },
    ],
    sections,
  };
}

function formatKpiValue(value, emptyLabel = '—') {
  if (value == null || value === '') return emptyLabel;
  return String(value);
}

function buildAgentKpis(kpis) {
  const resolvedToday = kpis?.resolvedToday ?? 0;
  const slaAtRisk = kpis?.slaAtRisk ?? 0;
  const tma = kpis?.tma;
  return [
    {
      id: 'assigned',
      label: 'Atribuídos a mim',
      value: formatKpiValue(kpis?.assigned, '0'),
      hint: 'total',
      tone: 'neutral',
      icon: 'ti ti-ticket',
    },
    {
      id: 'resolved',
      label: 'Resolvidos hoje',
      value: formatKpiValue(resolvedToday, '0'),
      hint: resolvedToday > 0 ? `+${resolvedToday} hoje` : 'hoje',
      tone: 'success',
      icon: 'ti ti-circle-check',
    },
    {
      id: 'sla',
      label: 'SLA próximo do limite',
      value: formatKpiValue(slaAtRisk, '0'),
      hint: slaAtRisk > 0 ? 'atenção' : null,
      tone: slaAtRisk > 0 ? 'warn' : 'neutral',
      icon: 'ti ti-clock-exclamation',
    },
    {
      id: 'csat',
      label: 'CSAT médio',
      value: '—',
      hint: 'Sem dados',
      tone: 'neutral',
      icon: 'ti ti-star',
    },
    {
      id: 'tma',
      label: 'TMA hoje',
      value: formatKpiValue(tma, '—'),
      hint: tma ? null : 'Sem dados',
      tone: tma ? 'success' : 'neutral',
      icon: 'ti ti-clock',
    },
  ];
}

function buildSupervisorKpis(kpis) {
  return {
    slaPct: kpis?.slaPct ?? 0,
    slaRisk: kpis?.slaRisk ?? 0,
    online: kpis?.online,
    tma: formatKpiValue(kpis?.tma, '—'),
    tme: formatKpiValue(kpis?.tme, '—'),
    nps: kpis?.nps == null ? '—' : String(kpis.nps),
    volume: formatKpiValue(kpis?.volume, '0'),
    warRoom: Boolean(kpis?.warRoom),
  };
}

export function buildAgent360View(apiPayload, agentName) {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const sections = (apiPayload?.sections ?? []).map((section) => ({
    ...section,
    tickets: (section.entries ?? []).map((entry) => mapEntryToRow(entry, section.variant)),
  }));

  return {
    greeting,
    agentName: agentName || getAgentName() || 'agente',
    dateTimeLabel: `${dateLabel.charAt(0).toUpperCase()}${dateLabel.slice(1)} · ${timeLabel}`,
    alert: apiPayload?.alert ?? null,
    kpis: buildAgentKpis(apiPayload?.kpis),
    sections,
    productionWeek: apiPayload?.productionWeek ?? [],
  };
}

export function buildSupervisor360View(apiPayload) {
  return {
    kpis: buildSupervisorKpis(apiPayload?.kpis),
    escalated: apiPayload?.escalated ?? { categories: [], slaCriticalCount: 0, groups: [] },
    channelVision: apiPayload?.channelVision ?? [],
    leaderboard: apiPayload?.leaderboard ?? { resolvedRanking: [], interactionRanking: [] },
  };
}

export const LEADERBOARD_SHIFT_OPTIONS = [
  { value: 'all', label: 'Turno: Todos' },
  { value: 'manha', label: 'Turno: Manhã' },
  { value: 'tarde', label: 'Turno: Tarde' },
  { value: 'noite', label: 'Turno: Noite' },
];

export const LEADERBOARD_CHANNEL_OPTIONS = [
  { value: 'all', label: 'Canal: Todos' },
  { value: 'whatsapp', label: 'Canal: WhatsApp' },
  { value: 'email', label: 'Canal: E-mail' },
  { value: 'telefone', label: 'Canal: Telefone' },
];

export function filterOperationalLeaderboard(entries, { shift = 'all', channel = 'all' } = {}) {
  return (entries ?? []).filter((entry) => {
    if (shift !== 'all' && entry.shift && entry.shift !== shift) return false;
    if (channel !== 'all' && entry.channel && entry.channel !== channel) return false;
    return true;
  });
}
