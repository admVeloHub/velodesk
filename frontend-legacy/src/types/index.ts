/** types v1.3.2 — isDraft para rascunho local de chamado */
export type VelodeskProfile = 'agent' | 'supervisor' | 'monitor' | 'training' | 'management';

export interface ProfileConfig {
  id: VelodeskProfile;
  label: string;
  desc: string;
  nav: string[];
  defaultPage: string;
  color: string;
}

export const PROFILES: Record<VelodeskProfile, ProfileConfig> = {
  agent: {
    id: 'agent',
    label: 'Agente',
    desc: 'Tickets, treinamentos e registro rápido',
    nav: ['workspace', 'tickets', 'chat', 'reports', 'config'],
    defaultPage: 'workspace',
    color: '#1634FF',
  },
  supervisor: {
    id: 'supervisor',
    label: 'Supervisor',
    desc: 'SLA, performance da equipe e escalonamentos',
    nav: ['workspace', 'dashboard', 'tickets', 'analytics-ia', 'reports', 'config'],
    defaultPage: 'workspace',
    color: '#006AB9',
  },
  monitor: {
    id: 'monitor',
    label: 'Monitoria',
    desc: 'Fila de avaliação e feedback de qualidade',
    nav: ['workspace', 'tickets', 'analytics-ia', 'reports'],
    defaultPage: 'workspace',
    color: '#1694FF',
  },
  training: {
    id: 'training',
    label: 'Treinamento',
    desc: 'Trilhas recomendadas e gaps de competência',
    nav: ['workspace', 'analytics-ia', 'config'],
    defaultPage: 'workspace',
    color: '#15A237',
  },
  management: {
    id: 'management',
    label: 'Gestão',
    desc: 'Visão executiva e indicadores estratégicos',
    nav: ['dashboard', 'analytics-ia', 'reports', 'config'],
    defaultPage: 'analytics-ia',
    color: '#FCC200',
  },
};

export const NAV_ITEMS: Record<string, { label: string; path: string }> = {
  workspace: { label: 'Painel 360°', path: '/workspace' },
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  tickets: { label: 'Chamados', path: '/tickets' },
  chat: { label: 'Chat', path: '/chat' },
  'analytics-ia': { label: 'Analytics IA', path: '/analytics-ia' },
  reports: { label: 'Relatórios', path: '/reports' },
  'client-portal': { label: 'Portal Cliente', path: '/client-portal' },
  config: { label: 'Configurações', path: '/config' },
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface TicketMessage {
  id?: string;
  text: string;
  sender: string;
  type?: string;
  time: string | Date;
  attachments?: string[];
}

export interface Ticket {
  _id: string;
  id?: string;
  chamadoProtocolo?: string;
  chamadoTitulo?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  channel?: string;
  source?: string;
  boxId?: string;
  clientName?: string;
  clientCPF?: string;
  responsibleAgent?: string;
  formData?: Record<string, unknown>;
  lateralForm?: Record<string, unknown>;
  messages?: TicketMessage[];
  internalNotes?: TicketMessage[];
  openedBy?: string;
  isDemo?: boolean;
  isDraft?: boolean;
  slaBreached?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  order: number;
  tickets: Ticket[];
}

export interface DashboardStats {
  total: number;
  resolved: number;
  pending: number;
  boxes: number;
  agents: number;
}

export const PRODUCT_TREE: Record<string, Record<string, string[]>> = {
  'Emprestimo Pessoal': {
    Solicitação: ['Em análise', 'Aguardando documentos', 'Aprovado', 'Recusado'],
    Reclamação: ['Cobrança indevida', 'Atraso na liberação', 'Informação incorreta'],
    Informação: ['Status do contrato', 'Saldo devedor', 'Condições do empréstimo'],
  },
  'Antecipação IRPF': {
    Solicitação: ['Em análise', 'Aguardando restituição', 'Liberação pendente'],
    Reclamação: ['Valor divergente', 'Atraso no crédito', 'Cancelamento solicitado'],
    Informação: ['Prazo de antecipação', 'Taxa aplicada', 'Status da operação'],
  },
  Seguros: {
    Solicitação: ['Nova contratação', 'Alteração de cobertura', 'Sinistro aberto'],
    Reclamação: ['Negativa de cobertura', 'Atraso na indenização', 'Cobrança indevida'],
    Informação: ['Apólice vigente', 'Carência', 'Documentação necessária'],
  },
};
