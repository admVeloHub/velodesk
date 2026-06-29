/**
 * velohubApi v1.0.0 — cliente API VeloHub (cadastro colaborador)
 * VERSION: v1.0.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */

const BASE = (import.meta.env.VITE_VELOHUB_API_URL || '').replace(/\/$/, '');

/**
 * Busca colaborador por e-mail (qualidade_funcionarios via API VeloHub).
 * Path placeholder — ajustar quando contrato hub for confirmado.
 */
export async function fetchColaboradorByEmail(userEmail, sessionId) {
  if (!BASE) {
    throw new Error('VITE_VELOHUB_API_URL não configurada');
  }
  const params = new URLSearchParams({ email: userEmail.trim() });
  const headers = { Accept: 'application/json' };
  if (sessionId) headers['X-Hub-Session-Id'] = sessionId;

  const res = await fetch(`${BASE}/api/colaboradores/by-email?${params}`, { headers });
  if (!res.ok) {
    const err = new Error(`VeloHub API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
