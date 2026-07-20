/** funcaoPermissaoDefaults v1.0.0 — seed RBAC por função Desk */

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

export const PERMISSION_CATALOG: Record<string, string[]> = {
  portal: ['agente', 'gestao', 'workflow', 'especiais'],
  tickets: ['ver_todos', 'ver_meus', 'atuar_responsavel', 'atuar_atribuido', 'atuar_canal_especial', 'escalonar'],
  workspace: ['painel_360_proprio', 'painel_360_equipe'],
  workflow: ['avancar', 'aprovar', 'rejeitar'],
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
};

const BASE_ATENDIMENTO = P({
  portal: { agente: true, gestao: false, workflow: false, especiais: false },
  tickets: { ver_todos: false, ver_meus: true, atuar_responsavel: true, atuar_atribuido: false, atuar_canal_especial: false, escalonar: false },
  workspace: { painel_360_proprio: true, painel_360_equipe: false },
  workflow: { avancar: true, aprovar: false, rejeitar: false },
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
      workflow: { aprovar: false },
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
    }),
  },
  {
    slug: 'financeiro',
    nome: 'Financeiro',
    nivel: 5,
    herdaDe: [],
    portalVisivel: ['agent'],
    permissoes: P({
      portal: { agente: true, gestao: false, workflow: false, especiais: false },
      tickets: { ver_todos: false, ver_meus: false, atuar_responsavel: false, atuar_atribuido: true, atuar_canal_especial: false },
      workspace: { painel_360_proprio: true, painel_360_equipe: false },
      workflow: { avancar: true, aprovar: false, rejeitar: true },
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
      tickets: { ver_todos: true, ver_meus: true, atuar_responsavel: true, atuar_atribuido: true, atuar_canal_especial: true, escalonar: true },
      workspace: { painel_360_proprio: true, painel_360_equipe: true },
      workflow: { avancar: true, aprovar: true, rejeitar: true },
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

/** Mapeia slug de grupo legado → slug de função */
export const GRUPO_TO_FUNCAO_MAP: Record<string, string> = {
  n1: 'atendimento',
  n2: 'n2',
  financeiro: 'financeiro',
  suporte: 'suporte',
};
