/**
 * Desk CRM — constantes de filas e classificação
 * VERSION: v2.3.1 | DATE: 2026-07-21
 */
export const MEUS_TICKETS_QUEUE_ID = 'meus-tickets';

export const QUEUE_STATUSES = [
  { id: 'novos', name: 'Novos', dot: '#1634FF', boxes: ['novos'] },
  { id: 'em-andamento', name: 'Em andamento', dot: '#15A237', boxes: ['em-andamento', 'em-aberto'] },
  { id: 'pendente', name: 'Pendente', dot: '#FCC200', boxes: ['em-espera', 'pendentes'] },
  { id: 'resolvidos', name: 'Resolvidos', dot: '#9ca3af', boxes: ['resolvidos'] },
  { id: MEUS_TICKETS_QUEUE_ID, name: 'Meus Tickets', dot: '#1694FF', boxes: [], virtual: true },
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
  { id: 'produtos', label: 'Produtos' },
  { id: 'suporte', label: 'Suporte' },
];

/** Encaminhamento do Desk Agente — abaixo de Detalhe */
export const AGENT_FORWARD_OPTIONS = [
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'produtos', label: 'Produtos' },
];

export const AGENT_FORWARD_IDS = new Set(['financeiro', 'produtos']);

export function isAgentForwardEscalonar(id) {
  return AGENT_FORWARD_IDS.has(id);
}

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

/** Termômetro do cliente no painel direito — oculto temporariamente no front. */
export const DESK_THERMOMETER_UI_ENABLED = false;
