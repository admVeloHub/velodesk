/**
 * Desk CRM — constantes de filas e classificação
 * VERSION: v2.2.0 | DATE: 2026-07-10
 */
export const QUEUE_STATUSES = [
  { id: 'novos', name: 'Novos', dot: '#1634FF', boxes: ['novos'] },
  { id: 'em-andamento', name: 'Em andamento', dot: '#15A237', boxes: ['em-andamento', 'em-aberto'] },
  { id: 'pendente', name: 'Pendente', dot: '#FCC200', boxes: ['em-espera', 'pendentes'] },
  { id: 'resolvidos', name: 'Resolvidos', dot: '#9ca3af', boxes: ['resolvidos'] }
];

export const SEND_STATUS_OPTIONS_AGENT = [
  { id: 'em-andamento', label: 'Em andamento', cls: 'andamento' },
  { id: 'pendente', label: 'Pendente', cls: 'pendente' },
  { id: 'resolvidos', label: 'Resolvido', cls: 'resolvido' },
];

export const SEND_STATUS_OPTION_CANCELADO = {
  id: 'cancelado',
  label: 'Cancelado',
  cls: 'cancelado',
};

/** @deprecated use getSendStatusOptions */
export const SEND_STATUS_OPTIONS = SEND_STATUS_OPTIONS_AGENT;

export function getSendStatusOptions(profileRole = 'agent') {
  if (profileRole === 'supervisor') {
    return [...SEND_STATUS_OPTIONS_AGENT, SEND_STATUS_OPTION_CANCELADO];
  }
  return SEND_STATUS_OPTIONS_AGENT;
}

export function isSupervisorSendRole(profileRole) {
  return profileRole === 'supervisor';
}

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
  critical: 'SLA crítico',
};

/** Rótulo curto exibido no card da fila */
export const SLA_SHORT_LABELS = {
  ok: 'No prazo',
  warning: 'Atenção',
  critical: 'Crítico',
};

/** Corretor ortográfico do compose — desativado enquanto revisão IA for obrigatória */
export const COMPOSE_SPELLCHECK_ENABLED = false;
