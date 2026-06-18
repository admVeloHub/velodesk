/**
 * Perfis operacionais — espelho velodesk-ecosystem.js
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
export const PROFILES = {
  agent: {
    id: 'agent',
    label: 'Agente',
    icon: 'fa-headset',
    color: '#1634FF',
    desc: 'Tickets, fila operacional e registro rápido',
    nav: ['workspace', 'tickets', 'chat', 'reports', 'config'],
    defaultPage: 'workspace'
  },
  supervisor: {
    id: 'supervisor',
    label: 'Supervisor',
    icon: 'fa-user-tie',
    color: '#000058',
    desc: 'SLA, performance da equipe e escalonamentos',
    nav: ['workspace', 'dashboard', 'tickets', 'analytics-ia', 'reports', 'config'],
    defaultPage: 'workspace'
  },
  management: {
    id: 'management',
    label: 'Gestão',
    icon: 'fa-chart-line',
    color: '#dc2626',
    desc: 'Visão executiva e indicadores estratégicos',
    nav: ['dashboard', 'analytics-ia', 'reports', 'config'],
    defaultPage: 'analytics-ia'
  }
};

export const NAV_ITEMS = [
  { id: 'workspace', path: '/workspace', label: 'Painel 360°', icon: 'ti-layout-grid', tooltip: 'Painel 360°' },
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'ti-dashboard', tooltip: 'Dashboard' },
  { id: 'tickets', path: '/tickets', label: 'Tickets', icon: 'ti-ticket', tooltip: 'Tickets' },
  { id: 'chat', path: '/chat', label: 'Mensagens', icon: 'ti-message-2', tooltip: 'Mensagens', badge: true },
  { id: 'reports', path: '/reports', label: 'Relatórios', icon: 'ti-chart-bar', tooltip: 'Relatórios' },
  { id: 'config', path: '/config', label: 'Configurações', icon: 'ti-settings', tooltip: 'Configurações' },
  { id: 'analytics-ia', path: '/analytics-ia', label: 'Analytics IA', icon: 'ti-chart-line', tooltip: 'Analytics IA' },
  { id: 'client-portal', path: '/client-portal', label: 'Portal Cliente', icon: 'ti-external-link', tooltip: 'Portal do Cliente' }
];

export function getProfileMeta(id) {
  return PROFILES[id] || PROFILES.agent;
}
