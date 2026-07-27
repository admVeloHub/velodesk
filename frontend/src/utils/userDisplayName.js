/**
 * userDisplayName v1.1.0 — aliasColaborador ou primeiro+último nome
 * VERSION: v1.1.0 | DATE: 2026-07-27
 */

export function getEmailLocalPart(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized || '';
  return normalized.split('@')[0];
}

export function resolveFirstLastName(colaboradorNome) {
  const parts = String(colaboradorNome || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/**
 * Nome exibido em atendimentos, assinaturas e identificação do agente.
 * Precedência: aliasColaborador → primeiro+último (colaboradorNome) → name → e-mail local.
 */
export function resolveAgentDisplayName(input = {}) {
  const alias = String(input.aliasColaborador || '').trim();
  if (alias) return alias;

  const fromColaboradorNome = resolveFirstLastName(input.colaboradorNome);
  if (fromColaboradorNome) return fromColaboradorNome;

  const fromName = String(input.name || '').trim();
  if (fromName && !fromName.includes('@')) return fromName;

  return getEmailLocalPart(input.email);
}

export function getDeskDisplayName(userOrEmail, colaborador) {
  if (!userOrEmail && !colaborador) return '';

  if (typeof userOrEmail === 'string') {
    return resolveAgentDisplayName({
      email: userOrEmail,
      aliasColaborador: colaborador?.aliasColaborador,
      colaboradorNome: colaborador?.colaboradorNome,
    });
  }

  const user = userOrEmail || {};
  const col = colaborador || {};
  return resolveAgentDisplayName({
    aliasColaborador: user.aliasColaborador || col.aliasColaborador,
    colaboradorNome: user.colaboradorNome || col.colaboradorNome,
    name: user.name,
    email: user.email || col.userMail,
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
