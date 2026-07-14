/**
 * tabulationConfig v1.4.1 — responsavel preenchido pela sessão, sem validação manual
 * VERSION: v1.4.1 | DATE: 2026-07-10 | AUTHOR: VeloHub Development Team
 */

export const EMPTY_TABULATION = {
  produtos: [],
  opcoes: {
    tipoChamado: [],
    canalContato: [],
  },
};

export const TABULACAO_OPCOES_CATEGORIAS = {
  TIPO_CHAMADO: 'tipo_chamado',
  CANAL_CONTATO: 'canal_contato',
};

export const FALLBACK_TIPO_OPTIONS = ['Reclamação', 'Solicitação', 'Dúvida', 'Informação'];
export const FALLBACK_CANAL_OPTIONS = ['WhatsApp', 'Telefone', 'E-mail', 'Portal'];

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

export function getTipoChamadoOptions(config) {
  const values = (config?.opcoes?.tipoChamado || []).filter(Boolean);
  return values.length ? values : FALLBACK_TIPO_OPTIONS;
}

export function getCanalContatoOptions(config) {
  const values = (config?.opcoes?.canalContato || []).filter(Boolean);
  return values.length ? values : FALLBACK_CANAL_OPTIONS;
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

function normalizeMatchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function resolveOptionValue(options, rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  if (!options?.length) return value;

  if (options.includes(value)) return value;

  const normalized = normalizeMatchText(value);
  const exact = options.find((option) => normalizeMatchText(option) === normalized);
  if (exact) return exact;

  const partial = options.find((option) => {
    const candidate = normalizeMatchText(option);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  if (partial) return partial;

  const tokenMatch = options.find((option) => {
    const candidate = normalizeMatchText(option);
    const valueTokens = normalized.split(/\s+/).filter(Boolean);
    return valueTokens.length > 0 && valueTokens.every((token) => candidate.includes(token));
  });

  return tokenMatch || '';
}

export function hasApplyableTabulation(tabulation) {
  if (!tabulation) return false;
  return Boolean(
    String(tabulation.tipo || tabulation.tipoChamado || tabulation.classificacaoTipo || '').trim()
    || String(tabulation.produto || '').trim()
    || String(tabulation.motivo || '').trim()
    || String(tabulation.detalhe || '').trim()
  );
}

/** Converte texto "Tipo → Produto → Motivo → Detalhe" em objeto de tabulação */
export function parseTabulationDisplay(display) {
  const text = String(display || '').trim();
  if (!text || /incompleta|aguardando|gerando|sugestão/i.test(text)) return null;
  const parts = text.split(/\s*(?:→|->)\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return {
    tipo: parts[0] || '',
    produto: parts[1] || '',
    motivo: parts[2] || '',
    detalhe: parts[3] || '',
  };
}

/** Preenche rightFields com valores sugeridos pela IA, resolvendo opções da tabulação ativa */
export function applyTabulationSuggestion(prev, tabulation, config) {
  if (!tabulation) return { ...(prev || {}) };

  let next = { ...(prev || {}) };

  const tipo = String(
    tabulation.tipo || tabulation.tipoChamado || tabulation.classificacaoTipo || ''
  ).trim();
  if (tipo) next.tipo = tipo;

  const produtoRaw = String(tabulation.produto || '').trim();
  if (produtoRaw) {
    const produto = config
      ? resolveOptionValue(getProdutoNames(config), produtoRaw)
      : produtoRaw;
    if (produto) {
      next = applyCascadeFieldChange(next, 'produto', produto);

      const motivoRaw = String(tabulation.motivo || '').trim();
      if (motivoRaw) {
        const motivo = config
          ? resolveOptionValue(getMotivos(config, produto), motivoRaw)
          : motivoRaw;
        if (motivo) {
          next = applyCascadeFieldChange(next, 'motivo', motivo);

          const detalheRaw = String(tabulation.detalhe || '').trim();
          if (detalheRaw) {
            const detalhe = config
              ? resolveOptionValue(getDetalhes(config, produto, motivo), detalheRaw)
              : detalheRaw;
            if (detalhe) next.detalhe = detalhe;
          }
        }
      }
    }
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
  const tipo = String(rightFields?.tipo ?? rightFields?.classificacaoTipo ?? rightFields?.tipoChamado ?? DEFAULT_TIPO).trim() || DEFAULT_TIPO;

  if (!produto) missing.push('Produto');
  if (!tipo) missing.push('Tipo');

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
