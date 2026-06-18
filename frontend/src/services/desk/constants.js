/**
 * Desk CRM — constantes de filas e classificação
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
export const QUEUE_STATUSES = [
  { id: 'novos', name: 'Novos', dot: '#1634FF', boxes: ['novos'] },
  { id: 'em-andamento', name: 'Em andamento', dot: '#15A237', boxes: ['em-andamento', 'em-aberto'] },
  { id: 'pendente', name: 'Pendente', dot: '#FCC200', boxes: ['em-espera', 'pendentes'] },
  { id: 'resolvidos', name: 'Resolvidos', dot: '#9ca3af', boxes: ['resolvidos'] }
];

export const SEND_STATUS_OPTIONS = [
  { id: 'em-andamento', label: 'Enviar como: Em Andamento', cls: 'andamento' },
  { id: 'pendente', label: 'Enviar como: Pendente', cls: 'pendente' },
  { id: 'resolvidos', label: 'Enviar como: Resolvido', cls: 'resolvido' }
];

export const CASCADE_CATEGORIES = [
  { id: 'emprestimo-pessoal', label: 'Empréstimo pessoal' },
  { id: 'antecipacao', label: 'Antecipação' },
  { id: 'alteracao-dados', label: 'Alteração de dados' }
];

export const CASCADE_ACTIONS = [
  { id: 'cancelamento', label: 'Cancelamento' },
  { id: 'estorno', label: 'Estorno' }
];

export const ESCALONAR_OPTIONS = [
  { id: 'n2', label: 'N2' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'suporte', label: 'Suporte' }
];

export const SLA_LABELS = {
  ok: 'Dentro do prazo',
  warning: 'Atenção — SLA',
  critical: 'SLA crítico'
};
