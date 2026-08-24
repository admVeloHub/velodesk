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
  // helmet() aplica um CSP padrão (script-src 'self') que bloqueia o <script>
  // inline desta página pública. Relaxamos o CSP só aqui, mantendo o restante
  // da API sob a política padrão.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';",
  );
  res.type('html').sendFile(filePath);
});

export default router;
