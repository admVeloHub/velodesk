/**
 * devAuth v1.3.0 — quick login dev (sem Google SSO)
 * VERSION: v1.3.0 | DATE: 2026-07-02 | AUTHOR: VeloHub Development Team
 */

/** Token legado — sessões antigas devem ser descartadas */
export const DEV_LOCAL_TOKEN = 'dev-localhost-bypass';

/** Usuário de login rápido em ambiente de desenvolvimento */
export const DEV_QUICK_LOGIN_EMAIL = 'lucasmgravina@gmail.com';

export function isLocalDevBypass() {
  return false;
}

export function isDevQuickLoginEnabled() {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}
