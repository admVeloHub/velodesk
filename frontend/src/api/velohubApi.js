/**
 * velohubApi v1.2.0 — cliente API VeloHub (cadastro colaborador)
 * VERSION: v1.2.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { requireVelohubApiBaseUrl } from '../config/velohubApiConfig';

/**
 * Busca colaborador por e-mail (qualidade_funcionarios via API VeloHub).
 * Path placeholder — ajustar quando contrato hub for confirmado.
 */
export async function fetchColaboradorByEmail(userEmail, sessionId) {
  const base = requireVelohubApiBaseUrl();
  const params = new URLSearchParams({ email: userEmail.trim() });
  const headers = { Accept: 'application/json' };
  if (sessionId) headers['X-Hub-Session-Id'] = sessionId;

  const res = await fetch(`${base}/colaboradores/by-email?${params}`, { headers });
  if (!res.ok) {
    const err = new Error(`VeloHub API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
