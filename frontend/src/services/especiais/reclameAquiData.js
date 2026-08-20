/**
 * reclameAquiData — constantes do canal Reclame Aqui
 */
export const RA_TABS = [
  { id: 'tabela', label: 'Tabela', icon: 'ti-table' },
  { id: 'relatorios', label: 'Relatórios', icon: 'ti-chart-bar' },
];

export const RA_GROUPS = [
  { id: 'vencendo-hoje', label: 'Vencendo hoje', tone: 'danger' },
  { id: 'finalizadas', label: 'Finalizadas', tone: 'neutral' },
  { id: 'nao-respondidas', label: 'Não respondidas', tone: 'warning' },
  { id: 'respondidas', label: 'Respondidas', tone: 'success' },
];

export const RA_FILTER_CHIPS = [
  { id: 'nao-respondidas', label: 'Não respondidas' },
  { id: 'abertas', label: 'Abertas' },
  { id: 'passivel-nota', label: 'Passível de nota' },
  { id: 'vencendo-hoje', label: 'Vencendo hoje' },
  { id: 'finalizadas', label: 'Finalizadas' },
];

export const RA_STATUS = {
  NAO_RESPONDIDA: 'nao-respondida',
  RESPONDIDA: 'respondida',
  WORKFLOW_ATIVO: 'workflow-ativo',
  AGUARD_AVALIACAO: 'aguard-avaliacao',
};

export const RA_STATUS_LABELS = {
  [RA_STATUS.NAO_RESPONDIDA]: 'Não respondida',
  [RA_STATUS.RESPONDIDA]: 'Respondida',
  [RA_STATUS.WORKFLOW_ATIVO]: 'Workflow ativo',
  [RA_STATUS.AGUARD_AVALIACAO]: 'Aguard. avaliação',
};

export const RA_BRAND_COLOR = '#F97316';

export function getGroupMeta(groupKey) {
  return RA_GROUPS.find((g) => g.id === groupKey) || { id: groupKey, label: groupKey, tone: 'neutral' };
}

export function getStatusLabel(statusRa) {
  return RA_STATUS_LABELS[statusRa] || statusRa;
}

export const RA_TIPOS = [
  'Reclamação',
  'Solicitação',
  'Elogio',
  'Dúvida',
];

/** Produtos do acordeão "Classificação de motivo" no sidebar do ticket — ordem alfabética. */
export const RA_CLASSIFICACAO_PRODUTOS = [
  'Antecipação 2026',
  'Antecipação outros anos',
  'Calculadora',
  'Conta Celcoin',
  'Conta Velotax',
  'Cupons',
  'Emprestimo Pessoal',
  'Indique e Ganhe',
  'Seguros',
];

export const RA_MOTIVOS = [
  'Abatimento de Juros',
  'Alega Fraude',
  'Alteração cadastral',
  'Cancelamento até 7 dias',
  'Cancelamento sup. 7 dias',
  'Desativado',
  'Dívida Prescrita',
  'Dúvidas Gerais',
  'Em cobrança',
  'Encerramento conta App',
  'Encerramento conta Celcoin',
  'Erro app',
  'Erro Gov',
  'Juros Abusivo',
  'Liberação chave pix',
  'Limite baixo do pix',
  'Não Elegível a crédito',
  'Portabilidade Pix',
  'Quitação automática sem chave pix',
  'Quitação do contrato',
  'Reativação cadastral',
  'Valor mínimo para contratação',
];

export const RA_WHATSAPP_DEFAULT_MSG =
  'Olá! Somos da equipe de atendimento. Recebemos sua reclamação no Reclame Aqui e estamos à disposição para ajudá-lo(a).';

export function formatSlaRestante(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Prazo vencido';
  const totalHours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return `${days} dia${days > 1 ? 's' : ''} e ${hours}h restantes`;
  }
  return `${hours}h restantes`;
}

export function computeIniciais(nome = '') {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
