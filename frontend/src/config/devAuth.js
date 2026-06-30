/**
 * devAuth v1.2.0 — bypass localhost removido (auth via Google allowlist)
 * VERSION: v1.2.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

/** Token legado — sessões antigas devem ser descartadas */
export const DEV_LOCAL_TOKEN = 'dev-localhost-bypass';

export function isLocalDevBypass() {
  return false;
}
