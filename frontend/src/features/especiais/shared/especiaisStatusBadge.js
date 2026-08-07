/**
 * Mapeia status de canal regulatório para classes status-badge do desk.
 */
const STATUS_BADGE_MAP = {
  'nao-respondida': 'novo',
  respondida: 'resolvido',
  'workflow-ativo': 'andamento',
  'aguard-avaliacao': 'pendente',
  'aguardando-audiencia': 'aguardando',
  'em-andamento': 'andamento',
  pendente: 'pendente',
  fechada: 'fechado',
  cancelada: 'cancelado',
};

export function mapChannelStatusToBadgeClass(statusKey) {
  if (!statusKey) return 'novo';
  const normalized = String(statusKey).trim().toLowerCase();
  return STATUS_BADGE_MAP[normalized] || 'novo';
}
