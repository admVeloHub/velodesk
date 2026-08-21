/** Labels do catálogo RBAC por função — v1.4.0 | DATE: 2026-08-21 */
import { derivePortalVisivelFromPermissoes } from '../../../services/permissions/permissionService';
import { NAV_ITEMS } from '../../../config/profiles';

/**
 * Módulos ocultos no editor de overrides (dado/permissão continua existindo e sendo aplicada
 * onde já era — só não aparece mais nesta tela):
 * - portal: função vai fazer mais sentido numa nova modalidade; por ora fica oculto.
 * - config / especiais: a visibilidade que essas seções tentavam controlar na barra retrátil
 *   agora é responsabilidade de "acesso" (Módulos de Acesso), mais granular. As permissões de
 *   ação (formularios_criar, *_gerenciar etc.) continuam existindo e sendo aplicadas nas rotas.
 * - preferencias: sem override — visível para todas as funções.
 */
const HIDDEN_MODULOS = new Set(['portal', 'config', 'especiais', 'preferencias']);

export const MODULO_ORDER = ['tickets', 'workspace', 'workflow', 'acesso'];

export const MODULO_LABELS = {
  tickets: 'Tickets',
  workspace: 'Workspace 360°',
  workflow: 'Workflow',
  acesso: 'Módulos de Acesso',
};

export const SUB_LABELS = {
  ver_todos: 'Ver todos os tickets (somente visualização)',
  ver_meus: 'Ver meus tickets (listas filtradas por responsável/atribuído)',
  atuar_responsavel: 'Atuar como responsável',
  atuar_atribuido: 'Atuar quando atribuído (workflow)',
  atuar_sempre: 'Atuar sempre (independente de responsável/atribuído)',
  atuar_canal_especial: 'Atuar em canal especial',
  painel_360_proprio: 'Painel 360° — próprios dados',
  painel_360_equipe: 'Painel 360° — equipe',
  avancar: 'Avançar workflow',
  aprovar: 'Aprovar workflow',
  rejeitar: 'Rejeitar workflow',
  interromper: 'Interromper workflow',
};

/** Rótulo de cada módulo dentro de "acesso" — reaproveita o label já usado na barra retrátil. */
export function acessoSubLabel(navId) {
  return NAV_ITEMS.find((item) => item.id === navId)?.label || navId;
}

/** Entradas do catálogo prontas para render — já sem os módulos ocultos, na ordem certa. */
export function sortCatalogEntriesVisible(catalog) {
  return sortCatalogEntries(catalog).filter(([modulo]) => !HIDDEN_MODULOS.has(modulo));
}

export function syncDraftPortalVisivel(draft) {
  if (!draft) return draft;
  const portalVisivel = derivePortalVisivelFromPermissoes(
    draft.permissoes,
    draft.portalVisivel || ['agent'],
  );
  return { ...draft, portalVisivel };
}

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
