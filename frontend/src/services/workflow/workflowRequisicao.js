/**
 * workflowRequisicao v1.3.1 — deskLog visível no console
 * VERSION: v1.3.1 | DATE: 2026-07-24
 */
import deskLog from '../../utils/deskDebugLog';

export const REQUISICAO_FIELD_DENYLIST = [
  'clienteCpf',
  'cpf',
  'tipoChamado',
  'classificacaoTipo',
  'produto',
  'motivo',
  'detalhe',
  'responsavel',
  'atribuido',
  'canal',
];

export const REQUISICAO_CAMPO_TIPOS = [
  { value: 'text', label: 'Texto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'boolean', label: 'Sim/Não' },
];

function normalizeFieldId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function buildRequisicaoDenylist(gatilho) {
  const deny = new Set(REQUISICAO_FIELD_DENYLIST);
  for (const c of gatilho?.criterios || []) {
    const campo = String(c.campo || '').trim().toLowerCase();
    if (campo) deny.add(campo);
  }
  return deny;
}

export function isReservedRequisicaoFieldId(fieldId, gatilho) {
  const normalized = normalizeFieldId(fieldId);
  if (!normalized) return true;
  return buildRequisicaoDenylist(gatilho).has(normalized);
}

export function createRequisicaoCampoClientKey() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugifyRequisicaoLabel(label, gatilho, existingIds = []) {
  let base = normalizeFieldId(label);
  if (!base) base = 'campo';
  if (isReservedRequisicaoFieldId(base, gatilho)) {
    base = `${base}_extra`;
  }
  const used = new Set(existingIds.map(normalizeFieldId));
  let candidate = base;
  let n = 2;
  while (used.has(candidate) || isReservedRequisicaoFieldId(candidate, gatilho)) {
    candidate = `${base}_${n}`;
    n += 1;
  }
  return candidate;
}

function resolveCampoId(raw) {
  return normalizeFieldId(raw?.label) || normalizeFieldId(raw?.id);
}

function debugRequisicaoRead(ticket, valores, source) {
  deskLog.requisicao('readTicketRequisicaoValores', {
    ticketId: String(ticket?.id || ticket?._id || ''),
    source,
    keys: Object.keys(valores || {}),
    valores,
  });
}

function mergeValoresMaps(...maps) {
  const merged = {};
  maps.forEach((map) => {
    if (!map || typeof map !== 'object') return;
    Object.entries(map).forEach(([key, value]) => {
      if (value === undefined) return;
      merged[key] = value;
    });
  });
  return merged;
}

function readRequisicaoValoresFromRegistro(ticket) {
  const historico = ticket?.registroHistorico || ticket?.registro || [];
  if (!Array.isArray(historico) || !historico.length) return {};

  for (let index = historico.length - 1; index >= 0; index -= 1) {
    const entry = historico[index];
    const meta = entry?.metadados;
    const fromMeta = meta?.requisicao?.valores;
    if (fromMeta && typeof fromMeta === 'object') {
      return fromMeta;
    }
  }
  return {};
}

export function normalizeRequisicaoConfig(requisicao, gatilho) {
  const deny = buildRequisicaoDenylist(gatilho);
  const seen = new Set();
  const campos = [];

  for (const raw of requisicao?.campos || []) {
    const label = String(raw?.label || '').trim();
    if (!label) continue;
    const id = resolveCampoId(raw);
    if (!id || deny.has(id) || seen.has(id)) continue;
    seen.add(id);
    campos.push({
      id,
      label,
      tipo: REQUISICAO_CAMPO_TIPOS.some((t) => t.value === raw.tipo) ? raw.tipo : 'text',
      obrigatorio: raw.obrigatorio === true,
      ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : campos.length,
      opcoes: Array.isArray(raw.opcoes)
        ? raw.opcoes
          .map((o) => ({
            valor: String(o?.valor ?? '').trim(),
            label: String(o?.label ?? o?.valor ?? '').trim(),
          }))
          .filter((o) => o.valor)
        : [],
      ajuda: String(raw.ajuda || '').trim(),
    });
  }

  return {
    campos: campos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
  };
}

/** Todos os campos da config (sem denylist) — exibição na tela de aprovação. */
export function resolveRequisicaoCamposForApproval(workflowDef) {
  if (!workflowDef) return [];
  const seen = new Set();
  const campos = [];

  for (const raw of workflowDef.requisicao?.campos || []) {
    const label = String(raw?.label || '').trim();
    if (!label) continue;
    const id = resolveCampoId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    campos.push({
      id,
      label,
      tipo: REQUISICAO_CAMPO_TIPOS.some((t) => t.value === raw.tipo) ? raw.tipo : 'text',
      obrigatorio: raw.obrigatorio === true,
      ordem: Number.isFinite(raw.ordem) ? Number(raw.ordem) : campos.length,
      opcoes: Array.isArray(raw.opcoes)
        ? raw.opcoes
          .map((o) => ({
            valor: String(o?.valor ?? '').trim(),
            label: String(o?.label ?? o?.valor ?? '').trim(),
          }))
          .filter((o) => o.valor)
        : [],
      ajuda: String(raw.ajuda || '').trim(),
    });
  }

  return campos.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export function resolveRequisicaoCamposVisiveis(workflowDef) {
  if (!workflowDef) return [];
  return normalizeRequisicaoConfig(workflowDef.requisicao, workflowDef.gatilho).campos;
}

export function validateRequisicaoFormValues(campos, valores = {}) {
  const errors = {};
  campos.forEach((campo) => {
    const raw = valores[campo.id];
    if (campo.tipo === 'boolean') return;
    const text = String(raw ?? '').trim();
    if (campo.obrigatorio && !text) {
      errors[campo.id] = `${campo.label} é obrigatório`;
    }
  });
  return errors;
}

export function buildTicketContextFields(ticket) {
  const lf = ticket?.lateralForm || {};
  const cpf = ticket?.clientCPF || lf.clienteCpf || lf.cpf || '';
  return [
    { label: 'CPF', value: cpf || '—' },
    { label: 'Tipo', value: lf.tipoChamado || lf.classificacaoTipo || '—' },
    { label: 'Produto', value: lf.produto || '—' },
    { label: 'Motivo', value: lf.motivo || ticket?.title || '—' },
    { label: 'Detalhe', value: lf.detalhe || ticket?.description || '—' },
    { label: 'Responsável', value: lf.responsavel || ticket?.responsibleAgent || '—' },
  ];
}

export function readTicketRequisicaoSnapshot(ticket) {
  return ticket?.workflow?.requisicao
    || ticket?.lateralForm?.workflow?.requisicao
    || null;
}

export function readTicketRequisicaoValores(ticket) {
  if (!ticket) return {};

  const fromWorkflow = ticket?.workflow?.requisicao?.valores;
  const fromLateral = ticket?.lateralForm?.workflow?.requisicao?.valores;
  const fromRegistro = readRequisicaoValoresFromRegistro(ticket);
  const snapshot = readTicketRequisicaoSnapshot(ticket);
  const fromSnapshot = snapshot?.valores;

  let source = 'none';
  const merged = mergeValoresMaps(fromRegistro, fromLateral, fromSnapshot, fromWorkflow);
  if (Object.keys(merged).length) {
    if (fromWorkflow && typeof fromWorkflow === 'object') source = 'workflow.requisicao';
    else if (fromSnapshot && typeof fromSnapshot === 'object') source = 'snapshot';
    else if (fromLateral && typeof fromLateral === 'object') source = 'lateralForm.workflow.requisicao';
    else if (Object.keys(fromRegistro).length) source = 'registro.metadados.requisicao';
  }

  debugRequisicaoRead(ticket, merged, source);
  return merged;
}

/** Resolve valor persistido independente de divergência id/rótulo na config. */
export function resolveRequisicaoValor(valores, campo) {
  if (!valores || typeof valores !== 'object' || !campo) return undefined;

  const candidates = [
    campo.id,
    normalizeFieldId(campo.label),
    normalizeFieldId(campo.id),
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];

  if (campo.tipo === 'boolean') {
    for (const key of uniqueCandidates) {
      if (Object.prototype.hasOwnProperty.call(valores, key)) {
        const raw = valores[key];
        return raw === true || raw === 'true';
      }
    }
    const target = new Set(uniqueCandidates.map(normalizeFieldId));
    for (const [key, raw] of Object.entries(valores)) {
      if (target.has(normalizeFieldId(key))) {
        return raw === true || raw === 'true';
      }
    }
    return undefined;
  }

  for (const key of uniqueCandidates) {
    const raw = valores[key];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return raw;
    }
  }

  const target = new Set(uniqueCandidates.map(normalizeFieldId));
  for (const [key, raw] of Object.entries(valores)) {
    if (!target.has(normalizeFieldId(key))) continue;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return raw;
    }
  }

  return undefined;
}

export function formatRequisicaoDisplayValue(campo, value) {
  if (campo.tipo === 'boolean') {
    return value === true || value === 'true' ? 'Sim' : 'Não';
  }
  if (campo.tipo === 'currency' && value != null && value !== '') {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
  }
  if (campo.tipo === 'select' && campo.opcoes?.length) {
    const match = campo.opcoes.find((o) => o.valor === value);
    return match?.label || String(value ?? '—');
  }
  return String(value ?? '—').trim() || '—';
}
