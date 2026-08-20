/**
 * proconData — constantes do canal Procon
 */
export const PC_TABS = [
  { id: 'tabela', label: 'Tabela', icon: 'ti-table' },
  { id: 'relatorios', label: 'Relatórios', icon: 'ti-chart-bar' },
];

export const PC_GROUPS = [
  { id: 'vencendo-hoje', label: 'Vencendo hoje', tone: 'danger' },
  { id: 'finalizadas', label: 'Finalizadas', tone: 'neutral' },
  { id: 'nao-respondidas', label: 'Não respondidas', tone: 'warning' },
  { id: 'respondidas', label: 'Respondidas', tone: 'success' },
];

export const PC_FILTER_CHIPS = [
  { id: 'nao-respondidas', label: 'Não respondidas' },
  { id: 'abertas', label: 'Abertas' },
  { id: 'workflow-ativo', label: 'Workflow ativo' },
  { id: 'vencendo-hoje', label: 'Vencendo hoje' },
  { id: 'finalizadas', label: 'Finalizadas' },
];

export const PC_STATUS = {
  NAO_RESPONDIDA: 'nao-respondida',
  RESPONDIDA: 'respondida',
  WORKFLOW_ATIVO: 'workflow-ativo',
  AGUARDANDO_AUDIENCIA: 'aguardando-audiencia',
};

export const PC_STATUS_LABELS = {
  [PC_STATUS.NAO_RESPONDIDA]: 'Não respondida',
  [PC_STATUS.RESPONDIDA]: 'Respondida',
  [PC_STATUS.WORKFLOW_ATIVO]: 'Workflow ativo',
  [PC_STATUS.AGUARDANDO_AUDIENCIA]: 'Aguard. audiência',
};

export const PC_BRAND_COLOR = '#0F766E';

export function getGroupMeta(groupKey) {
  return PC_GROUPS.find((g) => g.id === groupKey) || { id: groupKey, label: groupKey, tone: 'neutral' };
}

export function getStatusLabel(statusPc) {
  return PC_STATUS_LABELS[statusPc] || statusPc;
}

export const PC_PRODUTOS = [
  'Antecipação 2026',
  'Emprestimo Pessoal',
  'Antecipação do Salário',
  'Conta Velotax',
  'Conta Celcoin',
  'Calculadora',
  'Cupons',
  'Seguros',
  'Quero Quitar',
  'Sem Contato',
  'Indique e Ganhe',
];

export const PC_TIPOS = [
  'Reclamação',
  'Solicitação',
  'Notificação',
  'Auto de infração',
];

export const PC_MOTIVOS = [
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

/** Produtos do card "Classificação" no sidebar do ticket — ordem alfabética. */
export const PC_CLASSIFICACAO_PRODUTOS = [
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

export const PC_ORGAOS = [
  'Procon Municipal',
  'Procon Estadual',
  'Procon Regional',
  'CIP',
];

export const PC_WHATSAPP_DEFAULT_MSG =
  'Olá! Somos da equipe de atendimento. Recebemos sua demanda registrada no Procon e estamos à disposição para ajudá-lo(a).';

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
