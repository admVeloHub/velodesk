/**
 * deskAccessAllowlist v1.1.0 — DEPRECATED (login via cadastro Desk)
 * VERSION: v1.1.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 *
 * Allowlist de testes removida. O acesso oficial usa
 * console_funcionarios.funcionarios_cadastroColaboradores (acessos.Desk).
 * Mantido só para normalização de e-mail e compatibilidade de imports.
 */

export const DESK_AGENT_EMAILS = [];
export const DESK_SUPERVISOR_EMAILS = [];

export function normalizeDeskEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** @deprecated Use resolveDeskAccessFromCadastro no backend. */
export function resolveDeskAccessRole(_email) {
  return null;
}
