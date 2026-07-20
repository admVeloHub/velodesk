/** permissions.routes v1.0.0 — GET /permissions/me */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { resolveUserPermissions } from '../services/permission.service';

const router = Router();

router.get('/me', authMiddleware, async (req, res: Response) => {
  try {
    const resolved = await resolveUserPermissions(req.user!);
    res.json({
      funcaoSlug: resolved.funcaoSlug,
      funcoes: resolved.funcoes,
      permissoes: resolved.permissoes,
      portalVisivel: resolved.portalVisivel,
      nivel: resolved.nivel,
      canalOrigem: resolved.canalOrigem || null,
      colaboradorNome: resolved.colaboradorNome,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ message });
  }
});

export default router;
