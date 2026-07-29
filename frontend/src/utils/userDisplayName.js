/**
 * userDisplayName v1.2.0 — nome do operador só via cadastro do colaborador logado
 * VERSION: v1.2.0 | DATE: 2026-07-29
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
