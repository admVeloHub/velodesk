/**
 * Perfis operacionais — espelho velodesk-ecosystem.js
 * VERSION: v1.3.0 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */
export const PROFILES = {
  agent: {
    id: 'agent',
    label: 'Agente',
    icon: 'fa-headset',
    color: '#1634FF',
    desc: 'Tickets, fila operacional e registro rápido',
    nav: ['workspace', 'tickets', 'chat'],
    defaultPage: 'workspace'
  },
  supervisor: {
    id: 'supervisor',
    label: 'Supervisor',
    icon: 'fa-user-tie',
    color: '#000058',
    desc: 'SLA, performance da equipe e escalonamentos',
    nav: ['workspace', 'dashboard', 'tickets', 'config'],
    defaultPage: 'workspace'
  }
};

export const NAV_ITEMS = [
  { id: 'workspace', path: '/workspace', label: 'Painel 360°', icon: 'ti-layout-grid', tooltip: 'Painel 360°' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'ti-dashboard', tooltip: 'Dashboard' },
  { id: 'reports', path: '/reports', label: 'Relatórios', icon: 'ti-chart-bar', tooltip: 'Relatórios' },
  { id: 'tickets', path: '/tickets', label: 'Tickets', icon: 'ti-ticket', tooltip: 'Tickets' },
  { id: 'chat', path: '/chat', label: 'Mensagens', icon: 'ti-message-2', tooltip: 'Mensagens', badge: true },
  { id: 'config', path: '/config', label: 'Configurações', icon: 'ti-settings', tooltip: 'Configurações' },
  { id: 'client-portal', path: '/client-portal', label: 'Portal Cliente', icon: 'ti-external-link', tooltip: 'Portal do Cliente' }
];

export function getProfileMeta(id) {
  return PROFILES[id] || PROFILES.agent;
}

export function getProfileDefaultPath(profileId = 'agent') {
  const profile = getProfileMeta(profileId);
  const pageId = profile.defaultPage || 'workspace';
  if (pageId === 'tickets') return '/tickets?desk=v2';
  if (pageId === 'analytics-ia') return '/analytics-ia';
  return `/${pageId}`;
}
