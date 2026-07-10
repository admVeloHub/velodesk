/**
 * Relatórios operacionais supervisor — filtros UI e export CSV
 * VERSION: v2.0.0 | DATE: 2026-07-06
 */

export const PERIOD_OPTIONS = [
  { value: '7d', label: 'Período: Últimos 7 dias' },
  { value: '30d', label: 'Período: Últimos 30 dias' },
  { value: 'today', label: 'Período: Hoje' },
  { value: 'month', label: 'Período: Este mês' },
];

export const CHANNEL_OPTIONS = [
  { value: 'all', label: 'Canal: Todos' },
  { value: 'whatsapp', label: 'Canal: WhatsApp' },
  { value: 'email', label: 'Canal: E-mail' },
  { value: 'telefone', label: 'Canal: Telefone' },
];

export const TEAM_OPTIONS = [
  { value: 'all', label: 'Equipe: Todas' },
  { value: 'n1', label: 'Equipe: N1' },
  { value: 'n2', label: 'Equipe: N2' },
  { value: 'retencao', label: 'Equipe: Retenção' },
];

export const REPORT_CARDS = [
  {
    id: 'sla',
    icon: 'ti-clock',
    title: 'SLA operacional',
    desc: 'Cumprimento de prazos por fila, canal e equipe.',
    action: 'Ver relatório SLA',
  },
  {
    id: 'volume',
    icon: 'ti-chart-bar',
    title: 'Volume de tickets',
    desc: 'Entradas, resolvidos e backlog por período.',
    action: 'Ver relatório de volume',
  },
  {
    id: 'nps',
    icon: 'ti-mood-smile',
    title: 'NPS e satisfação',
    desc: 'Notas de atendimento e tendência semanal.',
    action: 'Ver relatório NPS',
  },
  {
    id: 'team',
    icon: 'ti-users',
    title: 'Performance da equipe',
    desc: 'TMA, TME e produtividade por agente.',
    action: 'Ver relatório de equipe',
  },
  {
    id: 'monitoria',
    icon: 'ti-headphones',
    title: 'Monitoria',
    desc: 'Scorecards, avaliações de qualidade e feedback por agente.',
    action: 'Abrir monitoria',
  },
];

function optionLabel(options, value) {
  return options.find((opt) => opt.value === value)?.label ?? value;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function normalizeReportPayload(report, filters = {}) {
  if (!report) return null;
  const periodLabel = optionLabel(PERIOD_OPTIONS, filters.period ?? '7d');
  const channelLabel = optionLabel(CHANNEL_OPTIONS, filters.channel ?? 'all');
  const teamLabel = optionLabel(TEAM_OPTIONS, filters.team ?? 'all');
  return {
    ...report,
    generatedAt: report.generatedAt || new Date().toLocaleString('pt-BR'),
    filters: report.filters || {
      period: periodLabel,
      channel: channelLabel,
      team: teamLabel,
    },
    summary: report.summary ?? [],
    columns: report.columns ?? [],
    rows: report.rows ?? [],
  };
}

export function buildReportCsv(report) {
  if (!report) return '';

  const lines = [
    ['Relatório', report.title],
    ['Gerado em', report.generatedAt],
    ['Filtros', `${report.filters?.period ?? ''} · ${report.filters?.channel ?? ''} · ${report.filters?.team ?? ''}`],
    [],
    report.columns,
    ...(report.rows ?? []),
  ];

  return lines.map((row) => row.map(csvCell).join(';')).join('\n');
}

export function downloadReportCsv(report) {
  const csv = buildReportCsv(report);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `relatorio-${report.id}-${stamp}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
