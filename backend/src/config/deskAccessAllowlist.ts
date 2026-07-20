/**
 * deskAccessAllowlist v1.1.0 — DEPRECATED (login via cadastro Desk)
 * VERSION: v1.1.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */

export type DeskAccessRole = 'agent' | 'supervisor';

export function normalizeDeskEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/** @deprecated Use resolveDeskAccessFromCadastro. */
export function resolveDeskAccessRole(_email: string): DeskAccessRole | null {
  return null;
}
