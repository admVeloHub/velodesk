/** velohubModules v1.0.0 — rotas e conteúdo mock do ecossistema VeloHub */

export const VELOHUB_MODULE_ROUTES = {
  home: '/home',
  conhecimento: '/conhecimento',
  apoio: '/apoio',
  desk: '/workspace',
  velobot: '/velobot',
} as const;

export type VelohubMockModule = keyof typeof VELOHUB_MODULE_ROUTES;

export const VELOHUB_HUB_PATHS = [
  VELOHUB_MODULE_ROUTES.home,
  VELOHUB_MODULE_ROUTES.conhecimento,
  VELOHUB_MODULE_ROUTES.apoio,
  VELOHUB_MODULE_ROUTES.velobot,
] as const;

export function resolveVelohubModule(pathname: string): VelohubMockModule {
  if (pathname === VELOHUB_MODULE_ROUTES.home) return 'home';
  if (pathname === VELOHUB_MODULE_ROUTES.conhecimento) return 'conhecimento';
  if (pathname === VELOHUB_MODULE_ROUTES.apoio) return 'apoio';
  if (pathname === VELOHUB_MODULE_ROUTES.velobot) return 'velobot';
  return 'desk';
}

export function isVelohubHubPath(pathname: string): boolean {
  return (VELOHUB_HUB_PATHS as readonly string[]).includes(pathname);
}

export interface VelohubModuleContent {
  title: string;
  subtitle: string;
  hint: string;
  highlights: string[];
}

export const VELOHUB_MODULE_CONTENT: Record<VelohubMockModule, VelohubModuleContent> = {
  home: {
    title: 'Home VeloHub',
    subtitle: 'Portal central do ecossistema — visão geral e atalhos do dia.',
    hint: 'Placeholder mock: ao selecionar Home, o header secundário Velodesk é ocultado.',
    highlights: ['Resumo de atividades', 'Comunicados internos', 'Acesso rápido aos módulos'],
  },
  conhecimento: {
    title: 'Conhecimento',
    subtitle: 'Base de conteúdos, playbooks e materiais de referência.',
    hint: 'Placeholder mock: conteúdo educacional do ecossistema VeloHub.',
    highlights: ['Artigos e procedimentos', 'Trilhas por perfil', 'Busca unificada'],
  },
  apoio: {
    title: 'Apoio',
    subtitle: 'Central de suporte interno e orientações operacionais.',
    hint: 'Placeholder mock: canal de apoio ao colaborador VeloHub.',
    highlights: ['FAQ operacional', 'Solicitações internas', 'Status de chamados'],
  },
  desk: {
    title: 'Desk',
    subtitle: 'Módulo operacional Velodesk.',
    hint: 'Conteúdo real do Desk nas rotas /workspace, /tickets e demais páginas.',
    highlights: [],
  },
  velobot: {
    title: 'VeloBot',
    subtitle: 'Assistente inteligente do ecossistema VeloHub.',
    hint: 'Placeholder mock: interface conversacional em desenvolvimento.',
    highlights: ['Perguntas frequentes', 'Sugestões contextuais', 'Atalhos por módulo'],
  },
};
