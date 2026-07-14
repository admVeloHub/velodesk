/**
 * Seções da Central de Configurações
 * VERSION: v1.3.2 | DATE: 2026-07-14
 */
export const CONFIG_SECTIONS = [
  {
    id: 'forms',
    label: 'Formulários',
    menuDesc: 'Campos e árvores de tabulação',
    cardDesc: 'Monte campos personalizados para os tickets',
    icon: 'ti-forms',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    menuDesc: 'Regras e fluxos automáticos',
    cardDesc: 'Automatize etapas do atendimento',
    icon: 'ti-hierarchy-2',
  },
  {
    id: 'grupos-atribuicoes',
    label: 'Grupos e Atribuições',
    menuDesc: 'Equipes e regras de atribuição por etapa',
    cardDesc: 'Defina grupos de responsabilidade e quem recebe cada etapa',
    icon: 'ti-users-group',
  },
  {
    id: 'automations',
    label: 'Automações',
    menuDesc: 'Rotinas e ações automáticas',
    cardDesc: 'Regras que executam sozinhas',
    icon: 'ti-bolt',
  },
  {
    id: 'triggers',
    label: 'Gatilhos',
    menuDesc: 'Condições que disparam ações',
    cardDesc: 'Configure eventos e condições de disparo',
    icon: 'ti-target',
  },
  {
    id: 'api',
    label: 'API Externa',
    cardTitle: 'API',
    menuDesc: 'Chaves e endpoints',
    cardDesc: 'Conecte sistemas externos',
    icon: 'ti-plug',
  },
  {
    id: 'backup',
    label: 'Backup / Restore',
    cardTitle: 'Backup',
    menuDesc: 'Exportar e restaurar dados',
    cardDesc: 'Proteja e restaure seus dados',
    icon: 'ti-database',
  },
];

export function getConfigSection(id) {
  return CONFIG_SECTIONS.find((s) => s.id === id) || null;
}
