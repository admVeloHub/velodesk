/** supervisor.ts v1.0.0 — guard para mutações de configuração */
import { Request, Response, NextFunction } from 'express';

export function supervisorMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Não autenticado' });
  }
  if (req.user.role !== 'supervisor') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}
