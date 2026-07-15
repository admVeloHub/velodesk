/**
 * atuacaoVision v1.0.0 — mapeia atuacao.funcao → visão Desk (agente | supervisão)
 * VERSION: v1.0.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
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
  'direcao',
]);

const AGENT_FUNCOES = new Set(['atendimento']);

export function normalizeFuncao(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function extractFuncoes(atuacao) {
  if (!Array.isArray(atuacao)) return [];
  return atuacao
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.funcao;
      return '';
    })
    .map(normalizeFuncao)
    .filter(Boolean);
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
