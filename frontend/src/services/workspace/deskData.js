/**
 * Workspace — formatadores e view model Painel 360°
 * VERSION: v3.0.0 | DATE: 2026-07-06
 */
import { getAgentName } from '../clientDb';
import { getSlaClass } from '../desk/utils';

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

export function mapEntryToRow(entry, sectionVariant, metaExtra) {
  const { ticket, queueId } = entry;
  const sla = ticket.slaStatus || getSlaClass(ticket);
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
  const meta = metaExtra || (queueId === 'novos' && ticket.createdAt
    ? formatOpenDuration(ticket.createdAt)
    : formatRelativeTime(updatedAt));

  return {
    id: String(ticket.id || ticket._id),
    initials: getInitials(ticket.clientName || ticket.solicitante),
    clientName: ticket.clientName || ticket.solicitante || 'Cliente',
    badge,
    subject: ticket.title || ticket.chamadoTitulo || ticket.description || 'Sem assunto',
    channelIcon: channelIcon(channel),
    meta,
    slaLabel: formatSlaLabel(ticket, sla),
    slaTone,
    tags: buildTags(ticket),
    accent,
    unread: queueId === 'novos' || queueId === 'pendente',
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
    leaderboard: apiPayload?.leaderboard ?? [],
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

/** @deprecated use buildAgent360View */
export function computeAgent360View() {
  return buildAgent360View({}, getAgentName());
}
