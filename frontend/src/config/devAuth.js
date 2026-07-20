/**
 * devAuth v1.4.0 — login provisório desativado (SSO cadastro Desk)
 * VERSION: v1.4.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */

/** Token legado — sessões antigas devem ser descartadas */
export const DEV_LOCAL_TOKEN = 'dev-localhost-bypass';

/** @deprecated login rápido desativado */
export const DEV_QUICK_LOGIN_EMAIL = '';

export function isLocalDevBypass() {
  return false;
}

/** Login provisório de desenvolvimento desativado. */
export function isDevQuickLoginEnabled() {
  return false;
}
