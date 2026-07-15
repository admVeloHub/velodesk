/**
 * velohubApi v1.3.1 — cliente API VeloHub (cadastro colaborador)
 * VERSION: v1.3.1 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import { requireVelohubApiBaseUrl, VELOHUB_API_PROXY_PREFIX } from '../config/velohubApiConfig';
import { readHubSession } from '../config/hubSession';

const LOG_PREFIX = '[velohub-colaboradores]';

function assertVelohubProxyBase(base) {
  if (base !== VELOHUB_API_PROXY_PREFIX || String(base).startsWith('/api')) {
    throw new Error(
      'Cadastro de colaboradores deve usar o proxy VeloHub (/velohub-api), não /api do VeloDesk.',
    );
  }
}

function buildHeaders(sessionId) {
  const headers = { Accept: 'application/json' };
  const sid = String(sessionId || '').trim();
  if (sid) headers['X-Hub-Session-Id'] = sid;
  return headers;
}

function resolveSessionId(explicit) {
  if (explicit) return String(explicit).trim();
  const session = readHubSession();
  return session?.sessionId ? String(session.sessionId).trim() : '';
}

function normalizeListPayload(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.colaboradores)) return raw.colaboradores;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function hasDeskAccess(colaborador) {
  const desk = colaborador?.acessos?.Desk ?? colaborador?.acessos?.desk;
  return desk === true;
}

function buildApiError(res, data, path) {
  const status = res.status;
  let message = data?.message || data?.error || `VeloHub API ${status}`;
  if (status === 404) {
    message = `Rota ${path} não encontrada no VeloHub (404). O endpoint precisa estar deployado na API VeloHub.`;
  }
  const err = new Error(message);
  err.status = status;
  err.path = path;
  return err;
}

/**
 * Busca colaborador por e-mail (API VeloHub / funcionarios_cadastroColaboradores).
 */
export async function fetchColaboradorByEmail(userEmail, sessionId) {
  const base = requireVelohubApiBaseUrl();
  assertVelohubProxyBase(base);
  const path = `/colaboradores/by-email`;
  const params = new URLSearchParams({ email: String(userEmail || '').trim() });
  const url = `${base}${path}?${params}`;
  console.info(LOG_PREFIX, 'GET by-email', { email: String(userEmail || '').trim() });

  const res = await fetch(url, {
    headers: buildHeaders(resolveSessionId(sessionId)),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = buildApiError(res, data, path);
    console.error(LOG_PREFIX, 'by-email falhou', { status: res.status, message: err.message });
    throw err;
  }
  return data;
}

/**
 * Lista colaboradores com acessos.Desk=true (contrato: GET /colaboradores?acesso=Desk).
 * Filtra no cliente desligados e reforça Desk=true caso a API retorne lista ampla.
 */
export async function fetchColaboradoresDesk(sessionId) {
  const base = requireVelohubApiBaseUrl();
  assertVelohubProxyBase(base);
  const path = '/colaboradores';
  const params = new URLSearchParams({ acesso: 'Desk' });
  const url = `${base}${path}?${params}`;
  console.info(LOG_PREFIX, 'GET lista Desk', { url });

  const res = await fetch(url, {
    headers: buildHeaders(resolveSessionId(sessionId)),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = buildApiError(res, data, `${path}?acesso=Desk`);
    console.error(LOG_PREFIX, 'lista falhou', {
      status: res.status,
      message: err.message,
      hint: res.status === 404
        ? 'Suba o backend VeloHub com a rota nova ou faça deploy; o proxy aponta para a API remota.'
        : undefined,
    });
    throw err;
  }

  const list = normalizeListPayload(data)
    .filter((item) => item && typeof item === 'object')
    .filter(hasDeskAccess)
    .filter((item) => item.desligado !== true);

  console.info(LOG_PREFIX, 'lista ok', { total: list.length });
  return list;
}
