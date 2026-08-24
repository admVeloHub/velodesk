/** csatPage.routes v1.0.0 — página pública de avaliação CSAT */
import { Router, type Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

function resolveCsatAssetPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'csat', 'csat.html'),
    path.join(__dirname, '..', '..', 'assets', 'csat', 'csat.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

router.get('/csat', (_req, res: Response) => {
  const filePath = resolveCsatAssetPath();
  if (!filePath) {
    return res.status(404).send('Página não encontrada.');
  }
  res.type('html').sendFile(filePath);
});

export default router;
