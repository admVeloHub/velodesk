/**
 * blockNoticiarioRoutes v1.0.3 — impede rotas de noticiário no backend VeloDesk
 * VERSION: v1.0.3 | DATE: 2026-07-15
 *
 * VeloNews (VeloHubCentral: console_conteudo.Velonews, velonews_acknowledgments)
 * é acessado somente via API VeloHub (proxy /velohub-api). Este backend não conecta
 * ao cluster VeloHubCentral nem persiste noticiário.
 */
import { Request, Response, NextFunction } from 'express';

const BLOCKED_PREFIXES = ['/api/velo-news', '/api/noticiario'];

export function blockNoticiarioRoutes(req: Request, res: Response, next: NextFunction): void {
  const path = req.path.toLowerCase();
  const blocked = BLOCKED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (blocked) {
    res.status(404).json({
      message:
        'VeloNews (console_conteudo no VeloHubCentral) é exclusivo da API VeloHub (/velohub-api). O backend VeloDesk não persiste noticiário.',
    });
    return;
  }

  next();
}
