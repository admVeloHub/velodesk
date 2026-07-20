/** funcoesPermissoes.routes v1.0.0 — CRUD matriz de permissões por função */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireGestaoOrPermission } from '../middleware/permission';
import {
  getEffectivePermissionsForSlug,
  getPermissionCatalog,
  listFuncoesPermissoes,
  replaceFuncaoPermissao,
  resolveEffectivePermissoes,
} from '../services/funcaoPermissao.service';
import { listAtuacoesVelohub, isAtuacoesAvailable } from '../services/atuacoesVelohub.service';
import { invalidatePermissionCache } from '../services/permission.service';

const router = Router();

router.get(
  '/catalog',
  authMiddleware,
  requireGestaoOrPermission('config', 'visualizar'),
  async (_req, res: Response) => {
    try {
      const catalog = getPermissionCatalog();
      let velohub: unknown[] = [];
      if (await isAtuacoesAvailable()) {
        velohub = await listAtuacoesVelohub();
      }
      res.json({ catalog, velohub });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message });
    }
  },
);

router.get(
  '/',
  authMiddleware,
  requireGestaoOrPermission('config', 'visualizar'),
  async (_req, res: Response) => {
    try {
      const funcoes = await listFuncoesPermissoes(true);
      const map = new Map(funcoes.map((f) => [f.slug, f]));
      const payload = funcoes.map((f) => ({
        ...f,
        permissoesEfetivas: resolveEffectivePermissoes(f, map),
      }));
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message });
    }
  },
);

router.get(
  '/:slug/effective',
  authMiddleware,
  requireGestaoOrPermission('config', 'visualizar'),
  async (req, res: Response) => {
    try {
      const effective = await getEffectivePermissionsForSlug(req.params.slug);
      if (!effective) return res.status(404).json({ message: 'Função não encontrada' });
      res.json(effective);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message });
    }
  },
);

router.put(
  '/:slug',
  authMiddleware,
  requireGestaoOrPermission('config', 'workflows_editar'),
  async (req, res: Response) => {
    try {
      const updatedBy = req.user?.email || req.user?.name || 'system';
      const doc = await replaceFuncaoPermissao(req.params.slug, req.body, updatedBy);
      invalidatePermissionCache();
      if (!doc) return res.status(404).json({ message: 'Função não encontrada' });
      const all = await listFuncoesPermissoes(true);
      const map = new Map(all.map((f) => [f.slug, f]));
      res.json({
        ...doc,
        permissoesEfetivas: resolveEffectivePermissoes(doc, map),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ message });
    }
  },
);

export default router;
