/**
 * Desk CRM — constantes de filas e classificação
 * VERSION: v2.3.6 | DATE: 2026-08-03
 */
export const MEUS_TICKETS_QUEUE_ID = 'meus-tickets';

/** Seção colapsável em Meus Tickets — tickets com status em-aberto (cliente respondeu). */
export const MY_TICKETS_SECTION_CLIENTE_RESPONDEU = 'cliente-respondeu';

/** Modos da busca global do Desk (Enter na fila). */
export const DESK_SEARCH_MODE_CPF = 'cpf';
export const DESK_SEARCH_MODE_TICKET = 'ticket';
/** Busca parcial ambígua — CPF ou protocolo. */
export const DESK_SEARCH_MODE_BOTH = 'both';
export const DESK_SEARCH_MODES = [DESK_SEARCH_MODE_CPF, DESK_SEARCH_MODE_TICKET, DESK_SEARCH_MODE_BOTH];

export const QUEUE_STATUSES = [
  { id: 'novos', name: 'Novos', dot: '#1634FF', boxes: ['novos'] },
  { id: MEUS_TICKETS_QUEUE_ID, name: 'Meus Tickets', dot: '#1694FF', boxes: [], virtual: true },
  { id: 'em-andamento', name: 'Em andamento', dot: '#15A237', boxes: ['em-andamento', 'em-aberto'] },
  { id: 'pendente', name: 'Pendente', dot: '#FCC200', boxes: ['em-espera', 'pendentes'] },
  { id: 'resolvidos', name: 'Resolvidos', dot: '#9ca3af', boxes: ['resolvidos'] },
];

export const AGENT_DESK_QUEUE_IDS = new Set(['novos', 'em-andamento', 'pendente', 'resolvidos']);

const DESK_QUEUE_URL_IDS = new Set([...AGENT_DESK_QUEUE_IDS, MEUS_TICKETS_QUEUE_ID]);

/** Valida fila vinda da URL do Desk; fallback quando ausente ou inválida. */
export function parseDeskQueueFromUrl(value, fallback = 'novos') {
  const id = String(value || '').trim();
  return DESK_QUEUE_URL_IDS.has(id) ? id : fallback;
}

/** Seção de Meus Tickets vinda da URL (?section=cliente-respondeu). */
export function parseDeskMyTicketsSectionFromUrl(value) {
  const id = String(value || '').trim();
  if (id === MY_TICKETS_SECTION_CLIENTE_RESPONDEU) return id;
  return null;
}

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
  const role = String(profileRole || 'agent').trim().toLowerCase();
  if (role === 'gestao' || role === 'supervisor') {
    return [...SEND_STATUS_OPTIONS_AGENT, SEND_STATUS_OPTION_CANCELADO];
  }
  return SEND_STATUS_OPTIONS_AGENT;
}

export function isGestaoSendRole(profileRole = 'agent') {
  const role = String(profileRole || 'agent').trim().toLowerCase();
  return role === 'gestao' || role === 'supervisor';
}

/** @deprecated use isGestaoSendRole */
export function isSupervisorSendRole(profileRole) {
  return isGestaoSendRole(profileRole);
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
