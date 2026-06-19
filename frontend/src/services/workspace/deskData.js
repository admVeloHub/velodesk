/**
 * Workspace — dados operacionais do painel 360°
 * VERSION: v2.1.0 | DATE: 2026-06-19
 */
import { getAllCockpitTickets } from '../kanbanStorage';
import { getAgentName } from '../clientDb';
import { getSlaClass } from '../desk/utils';

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

function mapEntryToRow(entry, sectionVariant) {
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
    agentName: desk.agentName || getAgentName() || 'Ana Silva',
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
