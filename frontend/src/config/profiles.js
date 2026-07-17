/**
 * Perfis operacionais — Agente / Gestão / Workflow / Especiais
 * VERSION: v1.5.0 | DATE: 2026-07-16 | AUTHOR: VeloHub Development Team
 */
export const PROFILES = {
  agent: {
    id: 'agent',
    label: 'Agente',
    icon: 'fa-headset',
    color: '#1634FF',
    desc: 'Tickets, fila operacional e registro rápido',
    nav: ['workspace', 'tickets', 'chat'],
    defaultPage: 'workspace',
  },
  gestao: {
    id: 'gestao',
    label: 'Gestão',
    icon: 'fa-user-tie',
    color: '#000058',
    desc: 'SLA, performance da equipe e escalonamentos',
    nav: ['workspace', 'dashboard', 'tickets', 'config'],
    defaultPage: 'workspace',
  },
  workflow: {
    id: 'workflow',
    label: 'Workflow',
    icon: 'fa-diagram-project',
    color: '#1694FF',
    desc: 'Fluxos operacionais entre times e acompanhamento de etapas',
    nav: ['workspace', 'workflow-inbox', 'dashboard'],
    defaultPage: 'workflow-inbox',
  },
  especiais: {
    id: 'especiais',
    label: 'Especiais',
    icon: 'fa-star',
    color: '#7C3AED',
    desc: 'Canais especiais — Reclame Aqui, Procon, Consumidor.Gov, Bacen e Processos',
    nav: [
      'workspace',
      'especiais-reclame-aqui',
      'especiais-procon',
      'especiais-consumidor-gov',
      'especiais-bacen',
      'especiais-processos',
    ],
    defaultPage: 'workspace',
  },
};

export const NAV_ITEMS = [
  { id: 'workspace', path: '/workspace', label: 'Painel 360°', icon: 'ti-layout-grid', tooltip: 'Painel 360°' },
  { id: 'workflow-inbox', path: '/workflow', label: 'Aprovações', icon: 'ti-checkbox', tooltip: 'Console de aprovações' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'ti-dashboard', tooltip: 'Dashboard' },
  { id: 'reports', path: '/reports', label: 'Relatórios', icon: 'ti-chart-bar', tooltip: 'Relatórios' },
  { id: 'tickets', path: '/tickets', label: 'Tickets', icon: 'ti-ticket', tooltip: 'Tickets' },
  {
    id: 'especiais-reclame-aqui',
    path: '/especiais/reclame-aqui',
    label: 'Reclame Aqui',
    icon: 'ti-messages',
    tooltip: 'Reclame Aqui',
  },
  {
    id: 'especiais-procon',
    path: '/especiais/procon',
    label: 'Procon',
    icon: 'ti-building-community',
    tooltip: 'Procon',
  },
  {
    id: 'especiais-consumidor-gov',
    path: '/especiais/consumidor-gov',
    label: 'Consumidor.Gov',
    icon: 'ti-world',
    tooltip: 'Consumidor.Gov',
  },
  {
    id: 'especiais-bacen',
    path: '/especiais/bacen',
    label: 'Bacen',
    icon: 'ti-building-bank',
    tooltip: 'Bacen',
  },
  {
    id: 'especiais-processos',
    path: '/especiais/processos',
    label: 'Processos',
    icon: 'ti-briefcase',
    tooltip: 'Processos',
  },
  { id: 'chat', path: '/chat', label: 'Mensagens', icon: 'ti-message-2', tooltip: 'Mensagens', badge: true },
  { id: 'config', path: '/config', label: 'Configurações', icon: 'ti-settings', tooltip: 'Configurações' },
  { id: 'client-portal', path: '/client-portal', label: 'Portal Cliente', icon: 'ti-external-link', tooltip: 'Portal do Cliente' },
];

const LEGACY_PROFILE_MAP = {
  supervisor: 'gestao',
  management: 'gestao',
};

export function normalizeProfileId(id) {
  const raw = String(id || 'agent').trim();
  if (PROFILES[raw]) return raw;
  if (LEGACY_PROFILE_MAP[raw]) return LEGACY_PROFILE_MAP[raw];
  return 'agent';
}

export function getProfileMeta(id) {
  return PROFILES[normalizeProfileId(id)];
}

export function getProfileDefaultPath(profileId = 'agent') {
  const profile = getProfileMeta(profileId);
  const pageId = profile.defaultPage || 'workspace';
  if (pageId === 'tickets') return '/tickets?desk=v2';
  if (pageId === 'workflow-inbox') return '/workflow';
  if (pageId === 'alteracoes-cadastrais') return '/alteracoes-cadastrais';
  if (pageId === 'analytics-ia') return '/analytics-ia';
  return `/${pageId}`;
}
