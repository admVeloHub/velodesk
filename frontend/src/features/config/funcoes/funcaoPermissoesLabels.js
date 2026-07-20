/** Labels do catálogo RBAC por função */
export const MODULO_ORDER = ['portal', 'tickets', 'workspace', 'workflow', 'config', 'especiais'];

export const MODULO_LABELS = {
  portal: 'Portal',
  tickets: 'Tickets',
  workspace: 'Workspace 360°',
  workflow: 'Workflow',
  config: 'Configurações',
  especiais: 'Canais Especiais',
};

export const SUB_LABELS = {
  agente: 'Visão Agente',
  gestao: 'Visão Gestão',
  workflow: 'Visão Workflow',
  especiais: 'Visão Especiais',
  ver_todos: 'Ver todos os tickets',
  ver_meus: 'Ver meus tickets',
  atuar_responsavel: 'Atuar como responsável',
  atuar_atribuido: 'Atuar quando atribuído (workflow)',
  atuar_canal_especial: 'Atuar em canal especial',
  painel_360_proprio: 'Painel 360° — próprios dados',
  painel_360_equipe: 'Painel 360° — equipe',
  escalonar: 'Escalonar tickets',
  avancar: 'Avançar workflow',
  aprovar: 'Aprovar workflow',
  rejeitar: 'Rejeitar workflow',
  visualizar: 'Visualizar configurações',
  formularios_criar: 'Formulários — criar',
  formularios_editar: 'Formulários — editar',
  formularios_excluir: 'Formulários — excluir',
  automacoes_criar: 'Automações — criar',
  automacoes_editar: 'Automações — editar',
  automacoes_excluir: 'Automações — excluir',
  workflows_editar: 'Workflows — editar',
  reclame_aqui_gerenciar: 'Reclame Aqui — gerenciar',
  bacen_gerenciar: 'Bacen — gerenciar',
  procon_gerenciar: 'Procon — gerenciar',
  consumidor_gov_gerenciar: 'Consumidor .GOV — gerenciar',
};

export function buildDraftFromFuncao(funcao) {
  if (!funcao) return null;
  return {
    nivel: funcao.nivel,
    herdaDe: [...(funcao.herdaDe || [])],
    portalVisivel: [...(funcao.portalVisivel || [])],
    permissoes: JSON.parse(JSON.stringify(funcao.permissoes || {})),
  };
}

export function countActivePerms(draft, modulo, keys) {
  if (!draft || !keys?.length) return 0;
  return keys.filter((key) => draft.permissoes?.[modulo]?.[key] === true).length;
}

export function sortCatalogEntries(catalog) {
  const entries = Object.entries(catalog || {});
  return entries.sort(([a], [b]) => {
    const ia = MODULO_ORDER.indexOf(a);
    const ib = MODULO_ORDER.indexOf(b);
    const sa = ia === -1 ? MODULO_ORDER.length : ia;
    const sb = ib === -1 ? MODULO_ORDER.length : ib;
    return sa - sb;
  });
}

export function listFuncoesPendentes(velohub, funcoes) {
  const configuredSlugs = new Set((funcoes || []).map((f) => f.slug));
  return (velohub || []).filter((v) => v?.funcaoSlug && !configuredSlugs.has(v.funcaoSlug));
}

export function buildEmptyDraftFromCatalog(catalog) {
  const permissoes = {};
  for (const [modulo, keys] of Object.entries(catalog || {})) {
    permissoes[modulo] = {};
    for (const key of keys || []) {
      permissoes[modulo][key] = false;
    }
  }
  return {
    nivel: 1,
    herdaDe: [],
    portalVisivel: ['agent'],
    permissoes,
  };
}

export function buildDraftFromVelohub(velohubItem, catalog) {
  if (!velohubItem) return null;
  return buildEmptyDraftFromCatalog(catalog);
}
