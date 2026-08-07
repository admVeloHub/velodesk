/**
 * Tema visual dos canais Especiais — paleta LAYOUT_GUIDELINES.md
 */
export const ESPECIAIS_CHANNEL_THEME = {
  'reclame-aqui': {
    accent: '#15A237',
    accentDark: '#128830',
    accentLight: '#22c55e',
    accentMuted: 'rgba(21, 162, 55, 0.12)',
    accentText: '#ffffff',
    topbarText: '#ffffff',
    queueGradient: 'linear-gradient(180deg, #128830 0%, #000058 100%)',
  },
  procon: {
    accent: '#1634FF',
    accentDark: '#0f28cc',
    accentLight: '#1694FF',
    accentMuted: 'rgba(22, 52, 255, 0.12)',
    accentText: '#ffffff',
    topbarText: '#ffffff',
    queueGradient: 'linear-gradient(180deg, #0f28cc 0%, #000058 100%)',
  },
  'consumidor-gov': {
    accent: '#006AB9',
    accentDark: '#005a9e',
    accentLight: '#1694FF',
    accentMuted: 'rgba(0, 106, 185, 0.12)',
    accentText: '#ffffff',
    topbarText: '#ffffff',
    queueGradient: 'linear-gradient(180deg, #005a9e 0%, #000058 100%)',
  },
  bacen: {
    accent: '#000058',
    accentDark: '#000033',
    accentLight: '#1634FF',
    accentMuted: 'rgba(0, 0, 88, 0.12)',
    accentText: '#ffffff',
    topbarText: '#ffffff',
    queueGradient: 'linear-gradient(180deg, #000033 0%, #000058 100%)',
  },
};

/** IDs de gestão (API) → canal especiais */
export const GESTAO_ORGAO_THEME_KEYS = {
  bacen: 'bacen',
  procon: 'procon',
  consumidorGov: 'consumidor-gov',
  reclameAqui: 'reclame-aqui',
};

const DEFAULT_THEME = ESPECIAIS_CHANNEL_THEME.procon;

export function getEspeciaisChannelTheme(channelId) {
  return ESPECIAIS_CHANNEL_THEME[channelId] ?? DEFAULT_THEME;
}

export function getEspeciaisThemeVars(channelId) {
  const theme = getEspeciaisChannelTheme(channelId);
  return {
    '--especiais-accent': theme.accent,
    '--especiais-accent-dark': theme.accentDark,
    '--especiais-accent-light': theme.accentLight,
    '--especiais-accent-muted': theme.accentMuted,
    '--especiais-accent-text': theme.accentText,
    '--especiais-topbar-text': theme.topbarText,
    '--especiais-queue-gradient': theme.queueGradient,
  };
}

export function getGestaoOrgaoTheme(orgaoId) {
  const channelKey = GESTAO_ORGAO_THEME_KEYS[orgaoId];
  return channelKey ? getEspeciaisChannelTheme(channelKey) : DEFAULT_THEME;
}
