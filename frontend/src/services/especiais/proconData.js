/**
 * proconData — constantes do canal Procon
 */
export const PC_TABS = [
  { id: 'tabela', label: 'Tabela', icon: 'ti-table' },
  { id: 'relatorios', label: 'Relatórios', icon: 'ti-chart-bar' },
];

export const PC_GROUPS = [
  { id: 'vencendo-hoje', label: 'Vencendo hoje', tone: 'danger' },
  { id: 'nao-respondidas', label: 'Não respondidas', tone: 'warning' },
  { id: 'respondidas', label: 'Respondidas', tone: 'success' },
];

export const PC_FILTER_CHIPS = [
  { id: 'nao-respondidas', label: 'Não respondidas' },
  { id: 'abertas', label: 'Abertas' },
  { id: 'workflow-ativo', label: 'Workflow ativo' },
  { id: 'vencendo-hoje', label: 'Vencendo hoje' },
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
  'Empréstimo',
  'Financeiro',
  'Fibra residencial',
  'Internet Fibra',
  'Combo',
  'Telefone',
];

export const PC_TIPOS = [
  'Reclamação',
  'Solicitação',
  'Notificação',
  'Auto de infração',
];

export const PC_MOTIVOS = [
  'Cobrança indevida',
  'Cancelamento',
  'Produto/serviço',
  'Atendimento',
  'Prazo de resposta',
  'Publicidade enganosa',
  'Outros',
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
