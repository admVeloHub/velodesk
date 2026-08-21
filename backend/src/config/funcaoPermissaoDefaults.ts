/** funcaoPermissaoDefaults v1.3.2 — removido client-portal */

export type PermissoesMap = Record<string, Record<string, boolean>>;

export interface FuncaoPermissaoSeed {
  slug: string;
  nome: string;
  nivel: number;
  herdaDe: string[];
  portalVisivel: string[];
  permissoes: PermissoesMap;
  canalOrigem?: string;
}

const P = (overrides: PermissoesMap): PermissoesMap => overrides;

/**
 * Módulos de Acesso — todo item de navegação da barra retrátil (frontend/src/config/profiles.js
 * NAV_ITEMS), exceto 'preferencias' (sem override — visível para todos). Cada chave aqui é um
 * boolean simples: true = a função vê esse módulo na barra. Substitui a antiga união de
 * PROFILES[portal].nav (redundante com portal.* e causava módulos aparecendo/faltando fora de
 * controle, ex.: canais especiais) por segmentação explícita, um módulo por vez.
 */
export const ACESSO_MODULO_IDS: string[] = [
  'workspace',
  'tickets',
  'busca-tickets',
  'atendimento-ia-telefonico',
  'realtime',
  'workflow-inbox',
  'config',
  'especiais-reclame-aqui',
  'especiais-procon',
  'especiais-consumidor-gov',
  'especiais-bacen',
  'especiais-processos',
  'reports',
  'tickets-resolvidos',
];

export const PERMISSION_CATALOG: Record<string, string[]> = {
  portal: ['agente', 'gestao', 'workflow', 'especiais'],
  tickets: ['ver_todos', 'ver_meus', 'atuar_responsavel', 'atuar_atribuido', 'atuar_canal_especial'],
  workspace: ['painel_360_proprio', 'painel_360_equipe'],
  workflow: ['avancar', 'aprovar', 'rejeitar', 'interromper'],
  preferencias: ['visualizar'],
  config: [
    'visualizar',
    'formularios_criar',
    'formularios_editar',
    'formularios_excluir',
    'automacoes_criar',
    'automacoes_editar',
    'automacoes_excluir',
    'workflows_editar',
  ],
  especiais: [
    'reclame_aqui_gerenciar',
    'bacen_gerenciar',
    'procon_gerenciar',
    'consumidor_gov_gerenciar',
  ],
  acesso: ACESSO_MODULO_IDS,
};

/** Todas as chaves de ACESSO_MODULO_IDS em `valor`, para montar overrides completos por função. */
function buildAcesso(valor: boolean, overrides: Record<string, boolean> = {}): Record<string, boolean> {
  const acesso: Record<string, boolean> = {};
  for (const id of ACESSO_MODULO_IDS) acesso[id] = valor;
  return { ...acesso, ...overrides };
}

const BASE_ATENDIMENTO = P({
  portal: { agente: true, gestao: false, workflow: false, especiais: false },
  tickets: { ver_todos: false, ver_meus: true, atuar_responsavel: true, atuar_atribuido: false, atuar_canal_especial: false },
  workspace: { painel_360_proprio: true, painel_360_equipe: false },
  workflow: { avancar: true, aprovar: false, rejeitar: false },
  preferencias: { visualizar: true },
  acesso: buildAcesso(false, { workspace: true, tickets: true, 'busca-tickets': true, 'atendimento-ia-telefonico': true }),
  config: {
    visualizar: false,
    formularios_criar: false,
    formularios_editar: false,
    formularios_excluir: false,
    automacoes_criar: false,
    automacoes_editar: false,
    automacoes_excluir: false,
    workflows_editar: false,
  },
  especiais: {
    reclame_aqui_gerenciar: false,
    bacen_gerenciar: false,
    procon_gerenciar: false,
    consumidor_gov_gerenciar: false,
  },
});

export const CANAL_ORIGEM_BY_FUNCAO: Record<string, string[]> = {
  'reclame-aqui': ['reclame aqui', 'reclame-aqui'],
  bacen: ['bacen', 'banco central'],
  procon: ['procon'],
  'consumidor-gov': ['consumidor.gov', 'consumidor .gov', 'consumidor-gov', 'consumidor gov'],
};

export const DEFAULT_FUNCOES_PERMISSOES: FuncaoPermissaoSeed[] = [
  {
    slug: 'atendimento',
    nome: 'Atendimento',
    nivel: 1,
    herdaDe: [],
    portalVisivel: ['agent'],
    permissoes: BASE_ATENDIMENTO,
  },
  {
    slug: 'n2',
    nome: 'N2',
    nivel: 2,
    herdaDe: ['atendimento'],
    portalVisivel: ['agent'],
    permissoes: P({
      tickets: { atuar_atribuido: true },
      workflow: { avancar: true },
    }),
  },
  {
    slug: 'suporte',
    nome: 'Suporte',
    nivel: 3,
    herdaDe: ['n2'],
    portalVisivel: ['agent'],
    permissoes: P({
      tickets: { ver_todos: true, atuar_responsavel: true, atuar_atribuido: true },
      config: {
        visualizar: true,
        formularios_criar: true,
        formularios_editar: true,
        formularios_excluir: true,
        automacoes_criar: true,
        automacoes_editar: true,
        automacoes_excluir: true,
        workflows_editar: false,
      },
      acesso: { config: true },
      workflow: { aprovar: false, interromper: true },
    }),
  },
  {
    slug: 'reclame-aqui',
    nome: 'Reclame Aqui',
    nivel: 4,
    herdaDe: ['n2'],
    portalVisivel: ['agent', 'especiais'],
    canalOrigem: 'reclame-aqui',
    permissoes: P({
      portal: { especiais: true },
      tickets: { atuar_canal_especial: true },
      especiais: { reclame_aqui_gerenciar: true },
      acesso: { 'especiais-reclame-aqui': true, 'especiais-processos': true },
    }),
  },
  {
    slug: 'bacen',
    nome: 'Bacen',
    nivel: 4,
    herdaDe: ['n2'],
    portalVisivel: ['agent', 'especiais'],
    canalOrigem: 'bacen',
    permissoes: P({
      portal: { especiais: true },
      tickets: { atuar_canal_especial: true },
      especiais: { bacen_gerenciar: true },
      acesso: { 'especiais-bacen': true, 'especiais-processos': true },
    }),
  },
  {
    slug: 'procon',
    nome: 'Procon',
    nivel: 4,
    herdaDe: ['n2'],
    portalVisivel: ['agent', 'especiais'],
    canalOrigem: 'procon',
    permissoes: P({
      portal: { especiais: true },
      tickets: { atuar_canal_especial: true },
      especiais: { procon_gerenciar: true },
      acesso: { 'especiais-procon': true, 'especiais-processos': true },
    }),
  },
  {
    slug: 'consumidor-gov',
    nome: 'Consumidor .GOV',
    nivel: 4,
    herdaDe: ['n2'],
    portalVisivel: ['agent', 'especiais'],
    canalOrigem: 'consumidor-gov',
    permissoes: P({
      portal: { especiais: true },
      tickets: { atuar_canal_especial: true },
      especiais: { consumidor_gov_gerenciar: true },
      acesso: { 'especiais-consumidor-gov': true, 'especiais-processos': true },
    }),
  },
  {
    slug: 'financeiro',
    nome: 'Financeiro',
    nivel: 5,
    herdaDe: [],
    portalVisivel: ['workflow'],
    permissoes: P({
      portal: { agente: false, gestao: false, workflow: true, especiais: false },
      tickets: { ver_todos: false, ver_meus: false, atuar_responsavel: false, atuar_atribuido: true, atuar_canal_especial: false },
      workspace: { painel_360_proprio: true, painel_360_equipe: false },
      workflow: { avancar: true, aprovar: true, rejeitar: true },
      preferencias: { visualizar: false },
      acesso: buildAcesso(false, { workspace: true, 'workflow-inbox': true, 'busca-tickets': true, 'tickets-resolvidos': true }),
      config: {
        visualizar: false,
        formularios_criar: false,
        formularios_editar: false,
        formularios_excluir: false,
        automacoes_criar: false,
        automacoes_editar: false,
        automacoes_excluir: false,
        workflows_editar: false,
      },
      especiais: {
        reclame_aqui_gerenciar: false,
        bacen_gerenciar: false,
        procon_gerenciar: false,
        consumidor_gov_gerenciar: false,
      },
    }),
  },
  {
    slug: 'produtos',
    nome: 'Produtos',
    nivel: 5,
    herdaDe: [],
    portalVisivel: ['workflow'],
    permissoes: P({
      portal: { agente: false, gestao: false, workflow: true, especiais: false },
      tickets: { ver_todos: false, ver_meus: false, atuar_responsavel: false, atuar_atribuido: true, atuar_canal_especial: false },
      workspace: { painel_360_proprio: true, painel_360_equipe: false },
      workflow: { avancar: true, aprovar: true, rejeitar: true },
      preferencias: { visualizar: false },
      acesso: buildAcesso(false, { workspace: true, 'workflow-inbox': true, 'busca-tickets': true, 'tickets-resolvidos': true }),
      config: {
        visualizar: false,
        formularios_criar: false,
        formularios_editar: false,
        formularios_excluir: false,
        automacoes_criar: false,
        automacoes_editar: false,
        automacoes_excluir: false,
        workflows_editar: false,
      },
      especiais: {
        reclame_aqui_gerenciar: false,
        bacen_gerenciar: false,
        procon_gerenciar: false,
        consumidor_gov_gerenciar: false,
      },
    }),
  },
  {
    slug: 'gestao',
    nome: 'Gestão',
    nivel: 9,
    herdaDe: [],
    portalVisivel: ['agent', 'gestao', 'workflow', 'especiais'],
    permissoes: P({
      portal: { agente: true, gestao: true, workflow: true, especiais: true },
      tickets: { ver_todos: true, ver_meus: true, atuar_responsavel: true, atuar_atribuido: true, atuar_canal_especial: true },
      workspace: { painel_360_proprio: true, painel_360_equipe: true },
      workflow: { avancar: true, aprovar: true, rejeitar: true, interromper: true },
      preferencias: { visualizar: true },
      acesso: buildAcesso(true),
      config: {
        visualizar: true,
        formularios_criar: true,
        formularios_editar: true,
        formularios_excluir: true,
        automacoes_criar: true,
        automacoes_editar: true,
        automacoes_excluir: true,
        workflows_editar: true,
      },
      especiais: {
        reclame_aqui_gerenciar: true,
        bacen_gerenciar: true,
        procon_gerenciar: true,
        consumidor_gov_gerenciar: true,
      },
    }),
  },
];

/** Chaves permissoes.portal → id do perfil operacional */
export const PORTAL_PERM_TO_PORTAL_ID: Record<string, string> = {
  agente: 'agent',
  gestao: 'gestao',
  workflow: 'workflow',
  especiais: 'especiais',
};

/** Deriva portalVisivel a partir das permissões efetivas de portal */
export function derivePortalVisivelFromPermissoes(
  permissoes: PermissoesMap,
  fallback: string[] = ['agent'],
): string[] {
  const portalPerms = permissoes?.portal;
  if (!portalPerms || typeof portalPerms !== 'object') return fallback;

  const hasExplicitPortal = Object.keys(PORTAL_PERM_TO_PORTAL_ID).some(
    (key) => typeof portalPerms[key] === 'boolean',
  );
  if (!hasExplicitPortal) return fallback;

  const derived = Object.entries(PORTAL_PERM_TO_PORTAL_ID)
    .filter(([key]) => portalPerms[key] === true)
    .map(([, id]) => id);

  return derived.length ? derived : fallback;
}

/** Mapeia slug de grupo legado → slug de função */
export const GRUPO_TO_FUNCAO_MAP: Record<string, string> = {
  n1: 'atendimento',
  n2: 'n2',
  financeiro: 'financeiro',
  produtos: 'produtos',
  suporte: 'suporte',
};
