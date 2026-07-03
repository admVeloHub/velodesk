/**
 * tabulationConfig v1.3.1 — defaults de tipo/responsável na validação
 * VERSION: v1.3.1 | DATE: 2026-07-03 | AUTHOR: VeloHub Development Team
 */

export const EMPTY_TABULATION = {
  produtos: [],
};

export const DEFAULT_TIPO = 'Solicitação';

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
  const agent = typeof getAgentName === 'function' ? getAgentName() : '';
  const tipo = String(lf.classificacaoTipo || lf.tipoChamado || DEFAULT_TIPO).trim() || DEFAULT_TIPO;
  return {
    responsavel: lf.responsavel || ticket?.responsibleAgent || agent,
    canal: lf.canal || ticket?.channel || 'WhatsApp',
    tipo,
    produto,
    motivo,
    detalhe,
  };
}

/** Garante defaults (tipo, responsável, canal) mesmo quando sessão salva veio incompleta */
export function mergeRightFieldsWithDefaults(partial, ticket, getAgentName) {
  const defaults = buildDefaultRightFields(null, ticket, getAgentName);
  const merged = { ...defaults, ...(partial || {}) };
  merged.tipo = String(merged.tipo || defaults.tipo || DEFAULT_TIPO).trim() || DEFAULT_TIPO;
  merged.responsavel = String(merged.responsavel || defaults.responsavel || '').trim() || defaults.responsavel;
  merged.canal = String(merged.canal || defaults.canal || 'WhatsApp').trim() || defaults.canal;
  return merged;
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

const SEND_STATUSES_REQUIRING_TABULATION = new Set(['em-andamento', 'resolvidos']);

export function validateTabulationForSendStatus(statusId, rightFields, config) {
  if (!SEND_STATUSES_REQUIRING_TABULATION.has(statusId)) {
    return { ok: true, missing: [], message: '' };
  }

  const missing = [];
  const produto = String(rightFields?.produto ?? '').trim();
  const motivo = String(rightFields?.motivo ?? '').trim();
  const detalhe = String(rightFields?.detalhe ?? '').trim();
  const responsavel = String(rightFields?.responsavel ?? '').trim();
  const tipo = String(rightFields?.tipo ?? rightFields?.classificacaoTipo ?? rightFields?.tipoChamado ?? DEFAULT_TIPO).trim() || DEFAULT_TIPO;

  if (!produto) missing.push('Produto');
  if (!tipo) missing.push('Tipo');
  if (!responsavel) missing.push('Responsável');

  if (produto) {
    const motivos = getMotivos(config, produto);
    if (motivos.length > 0 && !motivo) missing.push('Motivo');
    if (motivo) {
      const detalhes = getDetalhes(config, produto, motivo);
      if (detalhes.length > 0 && !detalhe) missing.push('Detalhe');
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length
      ? `Preencha a tabulação antes de enviar: ${missing.join(', ')}.`
      : '',
  };
}
