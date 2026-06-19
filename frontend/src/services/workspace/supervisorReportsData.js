/**
 * Dados demo — relatórios operacionais supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-19
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

const REPORT_CONTENT = {
  sla: {
    summary: [
      { label: 'SLA médio', value: '94,2%' },
      { label: 'Dentro do prazo', value: '1.842' },
      { label: 'Fora do prazo', value: '113' },
    ],
    columns: ['Fila', 'Canal', 'Equipe', 'SLA', 'Tempo médio'],
    rows: [
      ['Suporte N1', 'WhatsApp', 'N1', '96,1%', '12m 40s'],
      ['Suporte N1', 'E-mail', 'N1', '91,8%', '2h 05m'],
      ['Retenção', 'Telefone', 'Retenção', '93,4%', '8m 12s'],
      ['Suporte N2', 'WhatsApp', 'N2', '95,0%', '18m 22s'],
    ],
  },
  volume: {
    summary: [
      { label: 'Entradas', value: '2.148' },
      { label: 'Resolvidos', value: '1.976' },
      { label: 'Backlog', value: '172' },
    ],
    columns: ['Dia', 'Entradas', 'Resolvidos', 'Backlog', 'Variação'],
    rows: [
      ['Seg', '312', '298', '14', '+4,5%'],
      ['Ter', '289', '301', '-12', '-2,1%'],
      ['Qua', '341', '327', '14', '+6,2%'],
      ['Qui', '318', '305', '13', '+1,8%'],
      ['Sex', '288', '275', '13', '-0,9%'],
    ],
  },
  nps: {
    summary: [
      { label: 'NPS', value: '72' },
      { label: 'CSAT médio', value: '8,6' },
      { label: 'Respostas', value: '486' },
    ],
    columns: ['Semana', 'NPS', 'CSAT', 'Respostas', 'Tendência'],
    rows: [
      ['Sem 1', '68', '8,2', '112', 'Estável'],
      ['Sem 2', '70', '8,4', '118', '↑'],
      ['Sem 3', '71', '8,5', '121', '↑'],
      ['Sem 4', '72', '8,6', '135', '↑'],
    ],
  },
  team: {
    summary: [
      { label: 'TMA médio', value: '4m 18s' },
      { label: 'TME médio', value: '1m 42s' },
      { label: 'Tickets/agente', value: '18,4' },
    ],
    columns: ['Agente', 'Resolvidos', 'TMA', 'TME', 'CSAT'],
    rows: [
      ['Ana Silva', '32', '3m 12s', '1m 05s', '9,2'],
      ['Carlos Mendes', '15', '4m 28s', '1m 48s', '8,4'],
      ['Julia Costa', '12', '5m 01s', '2m 10s', '7,8'],
      ['Pedro Alves', '10', '4m 05s', '1m 52s', '8,1'],
    ],
  },
  monitoria: {
    summary: [
      { label: 'Score médio', value: '87,5' },
      { label: 'Avaliações', value: '64' },
      { label: 'Feedback pendente', value: '7' },
    ],
    columns: ['Agente', 'Score', 'Avaliações', 'Conformidade', 'Feedback'],
    rows: [
      ['Ana Silva', '92', '18', '98%', '2 pendentes'],
      ['Carlos Mendes', '86', '14', '91%', '1 pendente'],
      ['Julia Costa', '84', '16', '88%', '3 pendentes'],
      ['Pedro Alves', '88', '16', '93%', '1 pendente'],
    ],
  },
};

export function buildReportPayload(reportId, filters = {}) {
  const card = REPORT_CARDS.find((item) => item.id === reportId);
  const content = REPORT_CONTENT[reportId];
  if (!card || !content) return null;

  const periodLabel = optionLabel(PERIOD_OPTIONS, filters.period ?? '7d');
  const channelLabel = optionLabel(CHANNEL_OPTIONS, filters.channel ?? 'all');
  const teamLabel = optionLabel(TEAM_OPTIONS, filters.team ?? 'all');
  const generatedAt = new Date().toLocaleString('pt-BR');

  return {
    ...card,
    generatedAt,
    filters: {
      period: periodLabel,
      channel: channelLabel,
      team: teamLabel,
    },
    summary: content.summary,
    columns: content.columns,
    rows: content.rows,
  };
}

export function buildReportCsv(report) {
  if (!report) return '';

  const lines = [
    ['Relatório', report.title],
    ['Gerado em', report.generatedAt],
    ['Filtros', `${report.filters.period} · ${report.filters.channel} · ${report.filters.team}`],
    [],
    report.columns,
    ...report.rows,
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
