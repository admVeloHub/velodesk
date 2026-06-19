/**
 * Exportação — dashboard executivo
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: '7d', label: 'Período: Últimos 7 dias' },
  { value: '30d', label: 'Período: Últimos 30 dias' },
  { value: 'today', label: 'Período: Hoje' },
  { value: 'month', label: 'Período: Este mês' },
];

export const DASHBOARD_CHANNEL_OPTIONS = [
  { value: 'all', label: 'Canal: Todos' },
  { value: 'whatsapp', label: 'Canal: WhatsApp' },
  { value: 'email', label: 'Canal: E-mail' },
  { value: 'telefone', label: 'Canal: Telefone' },
];

export const DASHBOARD_TEAM_OPTIONS = [
  { value: 'all', label: 'Equipe: Todas' },
  { value: 'n1', label: 'Equipe: N1' },
  { value: 'n2', label: 'Equipe: N2' },
  { value: 'retencao', label: 'Equipe: Retenção' },
];

const FILTER_SCALE = {
  channel: { all: 1, whatsapp: 0.52, email: 0.28, telefone: 0.2 },
  team: { all: 1, n1: 0.45, n2: 0.35, retencao: 0.2 },
  period: { '7d': 1, '30d': 3.2, today: 0.18, month: 2.5 },
};

function optionLabel(options, value) {
  return options.find((opt) => opt.value === value)?.label ?? value;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function scaleFactor(filters) {
  const channel = FILTER_SCALE.channel[filters.channel] ?? 1;
  const team = FILTER_SCALE.team[filters.team] ?? 1;
  const period = FILTER_SCALE.period[filters.period] ?? 1;
  return channel * team * period;
}

function scaleCount(value, filters) {
  return Math.max(0, Math.round(Number(value || 0) * scaleFactor(filters)));
}

function scalePercent(value, filters) {
  const numeric = parseFloat(String(value).replace('%', '').replace(',', '.'));
  if (Number.isNaN(numeric)) return value;
  const factor = scaleFactor(filters);
  const adjusted = Math.min(100, Math.max(0, numeric * (0.85 + factor * 0.15)));
  return `${adjusted.toFixed(0)}%`;
}

export function applyDashboardFilters(baseMetrics, filters) {
  const factor = scaleFactor(filters);
  const weekly = (baseMetrics.weekly || []).map((value) => Math.max(0, Math.round(value * factor)));

  return {
    resolved: scaleCount(baseMetrics.resolved, filters),
    inProgress: scaleCount(baseMetrics.inProgress, filters),
    pending: scaleCount(baseMetrics.pending, filters),
    total: scaleCount(baseMetrics.total, filters),
    satisfaction: scalePercent(baseMetrics.satisfaction, filters),
    activeAgents: Math.max(1, Math.round(Number(baseMetrics.activeAgents || 1) * (filters.team === 'all' ? 1 : 0.55))),
    weekly,
  };
}

export function buildDashboardExportDocument(metrics, filters) {
  const periodLabel = optionLabel(DASHBOARD_PERIOD_OPTIONS, filters.period);
  const channelLabel = optionLabel(DASHBOARD_CHANNEL_OPTIONS, filters.channel);
  const teamLabel = optionLabel(DASHBOARD_TEAM_OPTIONS, filters.team);
  const generatedAt = new Date().toLocaleString('pt-BR');
  const weeklyLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

  return {
    title: 'Dashboard Executivo',
    generatedAt,
    filters: {
      period: periodLabel,
      channel: channelLabel,
      team: teamLabel,
    },
    kpis: [
      { label: 'Tickets Resolvidos', value: metrics.resolved },
      { label: 'Total na fila', value: metrics.total },
      { label: 'Satisfação', value: metrics.satisfaction },
      { label: 'Agentes Ativos', value: metrics.activeAgents },
    ],
    distribution: [
      { label: 'Resolvidos', value: metrics.resolved },
      { label: 'Em andamento', value: metrics.inProgress },
      { label: 'Pendentes', value: metrics.pending },
    ],
    weekly: weeklyLabels.map((day, index) => ({
      day,
      tickets: metrics.weekly[index] ?? 0,
    })),
  };
}

export function buildDashboardExportCsv(document) {
  const lines = [
    [document.title],
    ['Gerado em', document.generatedAt],
    ['Filtros', `${document.filters.period} · ${document.filters.channel} · ${document.filters.team}`],
    [],
    ['Indicadores Principais'],
    ['Métrica', 'Valor'],
    ...document.kpis.map((item) => [item.label, item.value]),
    [],
    ['Distribuição por status'],
    ['Status', 'Quantidade'],
    ...document.distribution.map((item) => [item.label, item.value]),
    [],
    ['Volume semanal'],
    ['Dia', 'Tickets'],
    ...document.weekly.map((item) => [item.day, item.tickets]),
  ];

  return lines.map((row) => row.map(csvCell).join(';')).join('\n');
}

export function downloadDashboardExport(exportDoc) {
  const csv = buildDashboardExportCsv(exportDoc);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `dashboard-executivo-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
