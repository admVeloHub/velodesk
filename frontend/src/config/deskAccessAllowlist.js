/**
 * deskAccessAllowlist v1.0.1 — fase testes Desk (Google SSO)
 * VERSION: v1.0.1 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */

export const DESK_AGENT_EMAILS = [
  'dimas.nascimento@velotax.com.br',
  'victor.silva@velotax.com.br',
  'monike.silva@velotax.com.br',
  'lucasmgravina@gmail.com',
];

export const DESK_SUPERVISOR_EMAILS = [
  'lucas.gravina@velotax.com.br',
  'emerson.jose@velotax.com.br',
  'andre.violaro@velotax.com.br',
  'octavio.silva@velotax.com.br',
  'nathalia.villanova@velotax.com.br',
  'camila.goncalves@velotax.com.br',
];

export function normalizeDeskEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function resolveDeskAccessRole(email) {
  const normalized = normalizeDeskEmail(email);
  if (DESK_SUPERVISOR_EMAILS.includes(normalized)) return 'supervisor';
  if (DESK_AGENT_EMAILS.includes(normalized)) return 'agent';
  return null;
}
