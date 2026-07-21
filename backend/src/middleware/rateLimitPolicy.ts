/** rateLimitPolicy v1.0.0 — isenção de GETs frequentes e rotas de auth */
import type { Request } from 'express';

/** Prefixos relativos ao mount /api/ — req.path após app.use('/api/', limiter) */
const FREQUENT_READ_PREFIXES = [
  '/boxes',
  '/tabulation',
  '/workflows',
  '/workflow-notificacoes',
  '/permissions/me',
  '/colaboradores/by-email',
  '/clients',
] as const;

export function isAuthOrHealthPath(path: string): boolean {
  return path === '/health'
    || path === '/api/health'
    || path === '/login'
    || path === '/api/login'
    || path.startsWith('/auth/')
    || path.startsWith('/api/auth/');
}

export function isFrequentReadPath(path: string): boolean {
  const normalized = path.split('?')[0] || '';
  return FREQUENT_READ_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function shouldSkipApiRateLimit(req: Request): boolean {
  const path = req.path || '';
  if (isAuthOrHealthPath(path)) return true;
  if (req.method === 'GET' && isFrequentReadPath(path)) return true;
  return false;
}
