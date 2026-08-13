/**
 * bacenData — constantes do canal Bacen
 */
export const BC_TABS = [
  { id: 'tabela', label: 'Tabela', icon: 'ti-table' },
  { id: 'relatorios', label: 'Relatórios', icon: 'ti-chart-bar' },
];

export const BC_GROUPS = [
  { id: 'vencendo-hoje', label: 'Vencendo hoje', tone: 'danger' },
  { id: 'finalizadas', label: 'Finalizadas', tone: 'neutral' },
  { id: 'nao-respondidas', label: 'Não respondidas', tone: 'warning' },
  { id: 'respondidas', label: 'Respondidas', tone: 'success' },
];

export const BC_FILTER_CHIPS = [
  { id: 'nao-respondidas', label: 'Não respondidas' },
  { id: 'abertas', label: 'Abertas' },
  { id: 'workflow-ativo', label: 'Workflow ativo' },
  { id: 'vencendo-hoje', label: 'Vencendo hoje' },
  { id: 'finalizadas', label: 'Finalizadas' },
];

export const BC_STATUS = {
  NAO_RESPONDIDA: 'nao-respondida',
  RESPONDIDA: 'respondida',
  WORKFLOW_ATIVO: 'workflow-ativo',
  AGUARDANDO_AUDIENCIA: 'aguardando-audiencia',
};

export const BC_STATUS_LABELS = {
  [BC_STATUS.NAO_RESPONDIDA]: 'Não respondida',
  [BC_STATUS.RESPONDIDA]: 'Respondida',
  [BC_STATUS.WORKFLOW_ATIVO]: 'Workflow ativo',
  [BC_STATUS.AGUARDANDO_AUDIENCIA]: 'Aguard. audiência',
};

export const BC_BRAND_COLOR = '#000058';

export function getGroupMeta(groupKey) {
  return BC_GROUPS.find((g) => g.id === groupKey) || { id: groupKey, label: groupKey, tone: 'neutral' };
}

export function getStatusLabel(statusBc) {
  return BC_STATUS_LABELS[statusBc] || statusBc;
}

export const BC_PRODUTOS = [
  'Empréstimo',
  'Financeiro',
  'Fibra residencial',
  'Internet Fibra',
  'Combo',
  'Telefone',
];

export const BC_TIPOS = [
  'Reclamação',
  'Solicitação',
  'Notificação',
  'Denúncia',
];

export const BC_MOTIVOS = [
  'Cobrança indevida',
  'Cancelamento',
  'Produto/serviço',
  'Atendimento',
  'Prazo de resposta',
  'Publicidade enganosa',
  'Outros',
];

export const BC_ORGAOS = [
  'Bacen — RDR',
  'Bacen — Reclamação',
  'Bacen — Ouvidoria',
  'CIP',
];

export const BC_WHATSAPP_DEFAULT_MSG =
  'Olá! Somos da equipe de atendimento. Recebemos sua demanda registrada no Bacen e estamos à disposição para ajudá-lo(a).';

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
