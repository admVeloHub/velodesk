/** permission middleware v1.0.0 */
import { Request, Response, NextFunction } from 'express';
import {
  assertPermission,
  PermissionDeniedError,
  resolveUserPermissions,
  hasPermission,
} from '../services/permission.service';

export function permissionMiddleware(modulo: string, key: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    try {
      await assertPermission(req.user, modulo, key);
      next();
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        return res.status(err.status).json({ message: err.message });
      }
      next(err);
    }
  };
}

export function requireGestaoOrPermission(modulo: string, key: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    try {
      const resolved = await resolveUserPermissions(req.user);
      if (
        resolved.funcaoSlug === 'gestao'
        || resolved.funcoes.includes('gestao')
        || String(req.user.role).toLowerCase() === 'supervisor'
        || hasPermission(resolved.permissoes, modulo, key)
      ) {
        return next();
      }
      return res.status(403).json({ message: `Sem permissão: ${modulo}.${key}` });
    } catch (err) {
      next(err);
    }
  };
}
