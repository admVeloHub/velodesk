/**
 * devLoginHelpers v1.0.0 — retry dev login quando backend ainda não subiu
 * VERSION: v1.0.0 | DATE: 2026-07-17 | AUTHOR: VeloHub Development Team
 */

export const DEV_LOGIN_RETRY_MS = 3000;

export function isDevLoginRetryableError(err) {
  const status = err?.response?.status;
  const apiMsg = String(err?.response?.data?.message || '').trim();

  if (status === 503 || /mongodb|banco de dados/i.test(apiMsg)) return true;
  if (!err?.response) return true;
  if (status === 502 || status === 504) return true;
  if (status === 500 && !apiMsg) return true;

  return false;
}

export function resolveDevLoginError(err) {
  const status = err?.response?.status;
  const apiMsg = String(err?.response?.data?.message || '').trim();

  if (isDevLoginRetryableError(err)) {
    if (/mongodb|banco de dados/i.test(apiMsg)) {
      return 'Aguardando o backend conectar ao banco de dados. Tentando novamente…';
    }
    return 'Aguardando o backend iniciar. Tentando novamente…';
  }
  if (status === 403) return 'Usuário sem permissão para acessar o Desk.';
  if (status === 401 && apiMsg) return apiMsg;
  if (apiMsg) return apiMsg;
  return err?.message || 'Não foi possível entrar no ambiente local.';
}
