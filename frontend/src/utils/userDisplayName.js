/**
 * userDisplayName v1.3.0 — responsável: alias ou primeiro+último (nunca login/e-mail)
 * VERSION: v1.3.0 | DATE: 2026-08-20
 *
 * Regra (funcionarios_cadastroColaboradores):
 * - aliasColaborador preenchido → aliasColaborador
 * - alias em branco → primeiro + último nome de colaboradorNome
 */

export function resolveFirstLastName(colaboradorNome) {
  const parts = String(colaboradorNome || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Nome exibido em atendimentos, assinaturas e identificação do agente.
 * Fonte: colaborador logado (aliasColaborador ou colaboradorNome).
 */
export function resolveAgentDisplayName(input = {}) {
  const alias = String(input.aliasColaborador || '').trim();
  if (alias) return alias;
  return resolveFirstLastName(input.colaboradorNome);
}

/** Nome do operador a partir da sessão (velodesk_colaborador / campos espelhados no user). */
export function getDeskDisplayName(userOrEmail, colaborador) {
  if (!userOrEmail && !colaborador) return '';

  const col = colaborador || {};
  if (typeof userOrEmail === 'object' && userOrEmail) {
    return resolveAgentDisplayName({
      aliasColaborador: col.aliasColaborador || userOrEmail.aliasColaborador,
      colaboradorNome: col.colaboradorNome || userOrEmail.colaboradorNome,
    });
  }

  return resolveAgentDisplayName({
    aliasColaborador: col.aliasColaborador,
    colaboradorNome: col.colaboradorNome,
  });
}

export function isLegacyDeskUser(user) {
  if (!user || typeof user !== 'object') return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return true;
  if (email === 'admin@velodesk.local') return true;
  if (user.source === 'dev-local') return true;
  return false;
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function emailLocalPart(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0] ?? '';
}

/** E-mail, login ou token sem espaço — nunca exibir como responsável. */
export function looksLikeNonDisplayResponsavelToken(value) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (v.includes('@')) return true;
  if (/^[a-z0-9._-]+$/i.test(v) && !/\s/.test(v)) return true;
  return false;
}

/** Mapa chave (email, login, nome) → nome exibido a partir da lista de colaboradores Desk. */
export function buildResponsavelDisplayIndex(colaboradores = []) {
  const map = new Map();
  (colaboradores || []).forEach((col) => {
    const raw = col?.raw || col;
    const display = resolveAgentDisplayName({
      aliasColaborador: raw?.aliasColaborador,
      colaboradorNome: raw?.colaboradorNome || col?.colaboradorNome,
    });
    if (!display) return;
    const keys = new Set();
    const push = (value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      keys.add(trimmed.toLowerCase());
      keys.add(normalizeLookupKey(trimmed));
    };
    push(raw?.userMail || col?.email);
    push(emailLocalPart(raw?.userMail || col?.email));
    push(raw?.colaboradorNome || col?.colaboradorNome);
    push(resolveFirstLastName(raw?.colaboradorNome || col?.colaboradorNome));
    push(display);
    keys.forEach((key) => map.set(key, display));
  });
  return map;
}

/** Formata valor persistido de responsável para exibição (alias ou primeiro+último). */
export function formatResponsavelDisplay(raw, colaboradores = []) {
  const stored = String(raw ?? '').trim();
  if (!stored) return '';

  const index = buildResponsavelDisplayIndex(colaboradores);
  const keys = [normalizeLookupKey(stored), stored.toLowerCase()];
  for (let i = 0; i < keys.length; i += 1) {
    const hit = index.get(keys[i]);
    if (hit) return hit;
  }

  if (looksLikeNonDisplayResponsavelToken(stored)) return '';
  return stored;
}
