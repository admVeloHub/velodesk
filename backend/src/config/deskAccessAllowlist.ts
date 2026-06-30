/**
 * deskAccessAllowlist v1.0.0 — fase testes Desk (Google SSO)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export type DeskAccessRole = 'agent' | 'supervisor';

const AGENT_EMAILS = new Set([
  'dimas.nascimento@velotax.com.br',
  'victor.silva@velotax.com.br',
  'monike.silva@velotax.com.br',
]);

const SUPERVISOR_EMAILS = new Set([
  'lucas.gravina@velotax.com.br',
  'emerson.jose@velotax.com.br',
  'andre.violaro@velotax.com.br',
  'octavio.silva@velotax.com.br',
  'nathalia.villanova@velotax.com.br',
  'camila.goncalves@velotax.com.br',
]);

export function normalizeDeskEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function resolveDeskAccessRole(email: string): DeskAccessRole | null {
  const normalized = normalizeDeskEmail(email);
  if (!normalized) return null;
  if (SUPERVISOR_EMAILS.has(normalized)) return 'supervisor';
  if (AGENT_EMAILS.has(normalized)) return 'agent';
  return null;
}
