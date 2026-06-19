/**
 * Casos escalados em atraso — dados demo supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */

export const ESCALATED_CASES_SUMMARY = {
  categories: [
    { id: 'financeiro', label: 'Financeiro', count: 4, accent: 'orange' },
    { id: 'estorno', label: 'Estorno', count: 3, accent: 'navy' },
  ],
  slaCriticalCount: 2,
  updatedLabel: 'Atualizado agora',
};

const TICKETS = [
  {
    id: '4512',
    category: 'financeiro',
    initials: 'MO',
    clientName: 'Maria Oliveira',
    badge: { text: 'SLA crítico', tone: 'critical' },
    subject: 'Cobrança indevida — contestação de fatura',
    channelIcon: 'ti ti-brand-whatsapp',
    meta: 'há 3h · Agente: Ana Silva',
    slaLabel: '92% SLA',
    slaTone: 'critical',
    tags: ['Financeiro', 'Cobrança'],
    accent: 'critical',
    unread: true,
  },
  {
    id: '4508',
    category: 'financeiro',
    initials: 'JP',
    clientName: 'João Pereira',
    badge: { text: 'Em atraso', tone: 'workflow' },
    subject: 'Bloqueio por inadimplência — acordo pendente',
    channelIcon: 'ti ti-world',
    meta: 'há 5h · Agente: Carlos Mendes',
    slaLabel: 'Atenção SLA',
    slaTone: 'warn',
    tags: ['Combo', 'Cobrança'],
    accent: 'workflow',
    unread: false,
  },
  {
    id: '4505',
    category: 'financeiro',
    initials: 'CM',
    clientName: 'Carlos Mendes',
    badge: { text: 'Em atraso', tone: 'workflow' },
    subject: 'Segunda via de boleto não recebida',
    channelIcon: 'ti ti-mail',
    meta: 'há 6h · Agente: Ana Silva',
    slaLabel: 'Dentro do prazo',
    slaTone: 'ok',
    tags: ['TV', 'Financeiro'],
    accent: 'workflow',
    unread: false,
  },
  {
    id: '4501',
    category: 'financeiro',
    initials: 'JF',
    clientName: 'João Ferreira',
    badge: { text: 'Em atraso', tone: 'workflow' },
    subject: 'Divergência no valor da fatura',
    channelIcon: 'ti ti-mail',
    meta: 'há 8h · Agente: Julia Costa',
    slaLabel: 'Dentro do prazo',
    slaTone: 'ok',
    tags: ['Internet Fibra', 'Cobrança'],
    accent: 'workflow',
    unread: false,
  },
  {
    id: '4509',
    category: 'estorno',
    initials: 'MO',
    clientName: 'Maria Oliveira',
    badge: { text: 'SLA crítico', tone: 'critical' },
    subject: 'Palavra-chave "Procon" — pedido de estorno',
    channelIcon: 'ti ti-brand-whatsapp',
    meta: 'há 1h · Agente: Ana Silva',
    slaLabel: 'Crítico SLA',
    slaTone: 'critical',
    tags: ['Estorno', 'Procon'],
    accent: 'critical',
    unread: true,
  },
  {
    id: '4510',
    category: 'estorno',
    initials: 'ET',
    clientName: 'Empresa Tech Ltda',
    badge: { text: 'Em atraso', tone: 'workflow' },
    subject: 'Estorno de taxa de instalação',
    channelIcon: 'ti ti-mail',
    meta: 'há 4h · Agente: Carlos Mendes',
    slaLabel: 'Atenção SLA',
    slaTone: 'warn',
    tags: ['Internet Fibra', 'Estorno'],
    accent: 'workflow',
    unread: false,
  },
  {
    id: '4511',
    category: 'estorno',
    initials: 'AS',
    clientName: 'Ana Souza',
    badge: { text: 'Em atraso', tone: 'workflow' },
    subject: 'Cancelamento com solicitação de estorno',
    channelIcon: 'ti ti-phone',
    meta: 'há 7h · Agente: Julia Costa',
    slaLabel: 'Dentro do prazo',
    slaTone: 'ok',
    tags: ['Combo', 'Estorno'],
    accent: 'workflow',
    unread: false,
  },
];

export function getEscalatedCasesGroups() {
  return ESCALATED_CASES_SUMMARY.categories.map((cat) => ({
    ...cat,
    tickets: TICKETS.filter((t) => t.category === cat.id),
  }));
}

export function getEscalatedCasesTickets() {
  return TICKETS;
}
