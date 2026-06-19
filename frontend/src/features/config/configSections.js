/**
 * Seções da Central de Configurações
 * VERSION: v1.1.0 | DATE: 2026-06-19
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
    id: 'backup',
    label: 'Backup / Restore',
    cardTitle: 'Backup',
    menuDesc: 'Exportar e restaurar dados',
    cardDesc: 'Proteja e restaure seus dados',
    icon: 'ti-database',
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
    id: 'macros',
    label: 'Macros',
    menuDesc: 'Respostas e atalhos prontos',
    cardDesc: 'Crie textos e ações reutilizáveis',
    icon: 'ti-template',
  },
];

export function getConfigSection(id) {
  return CONFIG_SECTIONS.find((s) => s.id === id) || null;
}
