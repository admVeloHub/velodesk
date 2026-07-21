/**
 * apiErrors v1.0.0 — mensagens compartilhadas de erro HTTP
 * VERSION: v1.0.0 | DATE: 2026-07-21 | AUTHOR: VeloHub Development Team
 */

export const RATE_LIMIT_USER_MESSAGE =
  'Muitas requisições ao servidor. Aguarde alguns minutos e recarregue a página.';

export function isRateLimitError(err) {
  return err?.response?.status === 429;
}
