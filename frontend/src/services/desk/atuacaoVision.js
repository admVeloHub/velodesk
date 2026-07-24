/**
 * atuacaoVision v1.3.0 — parse atuacao objeto/array + aliases produto
 * VERSION: v1.3.0 | DATE: 2026-07-24
 */

export const DESK_VISION = {
  AGENT: 'agent',
  GESTAO: 'gestao',
};

export const DESK_VISION_LABELS = {
  agent: 'Agente',
  gestao: 'Supervisão',
};

const SUPERVISION_FUNCOES = new Set([
  'gestao',
  'suporte supervisao',
  'suporte-supervisao',
  'direcao',
]);

const AGENT_FUNCOES = new Set(['atendimento']);

const FUNCAO_ALIASES = {
  produto: 'produtos',
  produtos: 'produtos',
  'time-produto': 'produtos',
  'time-produtos': 'produtos',
  'time-de-produto': 'produtos',
  'time-de-produtos': 'produtos',
};

function readFuncaoFromAtuacaoItem(item) {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    return item.funcao || item.slug || item.id || item.nome || item.label || item.value || '';
  }
  return '';
}

export function normalizeFuncao(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '');
  const slug = base.replace(/\s/g, '-');
  if (FUNCAO_ALIASES[slug]) return FUNCAO_ALIASES[slug];
  if (slug.includes('produto') && !slug.includes('atendimento')) return 'produtos';
  return slug;
}

export function extractFuncoes(atuacao) {
  if (Array.isArray(atuacao)) {
    return atuacao
      .map(readFuncaoFromAtuacaoItem)
      .map(normalizeFuncao)
      .filter(Boolean);
  }
  if (typeof atuacao === 'string' && atuacao.trim()) {
    return [normalizeFuncao(atuacao)];
  }
  if (atuacao && typeof atuacao === 'object') {
    const single = readFuncaoFromAtuacaoItem(atuacao);
    if (single) return [normalizeFuncao(single)];
  }
  return [];
}

/**
 * Regra: qualquer função de supervisão → gestao; senão atendimento → agent; default agent.
 */
export function resolveDeskVisionFromAtuacao(atuacao) {
  const funcoes = extractFuncoes(atuacao);
  if (funcoes.some((f) => SUPERVISION_FUNCOES.has(f))) {
    return DESK_VISION.GESTAO;
  }
  if (funcoes.some((f) => AGENT_FUNCOES.has(f))) {
    return DESK_VISION.AGENT;
  }
  return DESK_VISION.AGENT;
}

export function getDeskVisionLabel(visionId) {
  return DESK_VISION_LABELS[visionId] || DESK_VISION_LABELS.agent;
}

export function formatAtuacaoLabels(atuacao) {
  if (!Array.isArray(atuacao) || !atuacao.length) return '—';
  const labels = atuacao
    .map((item) => {
      if (typeof item === 'string') return String(item).trim();
      if (item && typeof item === 'object') return String(item.funcao || '').trim();
      return '';
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : '—';
}

/** Função atendimento → mensagem pública + tabulação editável */
export function hasAtendimentoFuncao(atuacao) {
  return extractFuncoes(atuacao).includes('atendimento');
}
