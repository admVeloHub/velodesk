/**
 * tabulationConfig v1.2.1 — helpers de cascata produto → motivo → detalhe
 * VERSION: v1.2.1 | DATE: 2026-06-25
 */

export const EMPTY_TABULATION = {
  produtos: [],
};

export function getActiveProdutos(config) {
  return (config?.produtos || []).filter((p) => p.ativo !== false);
}

export function getProdutoNames(config) {
  return getActiveProdutos(config).map((p) => p.produto);
}

export function findProduto(config, produtoName) {
  return getActiveProdutos(config).find((p) => p.produto === produtoName) || null;
}

export function getMotivos(config, produtoName) {
  const produto = findProduto(config, produtoName);
  if (!produto) return [];
  return (produto.motivos || [])
    .filter((m) => m.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((m) => m.motivo);
}

export function getDetalhes(config, produtoName, motivoName) {
  const produto = findProduto(config, produtoName);
  if (!produto) return [];
  const motivo = (produto.motivos || []).find((m) => m.motivo === motivoName && m.ativo !== false);
  if (!motivo) return [];
  return (motivo.detalhes || [])
    .filter((d) => d.ativo !== false)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    .map((d) => d.detalhe);
}

function hasSavedTabulationValue(value) {
  return Boolean(String(value ?? '').trim());
}

export function buildDefaultRightFields(_config, ticket, getAgentName) {
  const lf = ticket?.lateralForm || {};
  const produto = hasSavedTabulationValue(lf.produto) ? String(lf.produto).trim() : '';
  const motivo = produto && hasSavedTabulationValue(lf.motivo) ? String(lf.motivo).trim() : '';
  const detalhe = motivo && hasSavedTabulationValue(lf.detalhe) ? String(lf.detalhe).trim() : '';
  return {
    responsavel: lf.responsavel || ticket?.responsibleAgent || (typeof getAgentName === 'function' ? getAgentName() : ''),
    canal: lf.canal || ticket?.channel || 'WhatsApp',
    tipo: lf.classificacaoTipo || 'Solicitação',
    produto,
    motivo,
    detalhe,
  };
}

export function applyCascadeFieldChange(prev, key, value) {
  const next = { ...prev, [key]: value };
  if (key === 'produto') {
    next.motivo = '';
    next.detalhe = '';
  }
  if (key === 'motivo') {
    next.detalhe = '';
  }
  return next;
}
