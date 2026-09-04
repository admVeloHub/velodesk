/** macros.routes v1.0.0 — CRUD das macros de resposta rápida do compose */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supervisorMiddleware } from '../middleware/supervisor';
import { isDeskConfigConnected } from '../config/database';
import {
  createMacro,
  deleteMacro,
  getMacroById,
  listMacros,
  updateMacro,
} from '../services/macro.service';

const router = Router();

function actorName(req: Request): string {
  return req.user?.name || req.user?.email || 'sistema';
}

function deskConfigUnavailable(res: Response) {
  return res.status(503).json({ message: 'Configuração de macros indisponível' });
}

router.get('/', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const includeInactive = req.query.includeInactive === 'true';
    const macros = await listMacros(includeInactive);
    res.json(macros);
  } catch (err) {
    console.error('[macros] GET /:', err);
    return deskConfigUnavailable(res);
  }
});

router.get('/:id', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const macro = await getMacroById(String(req.params.id));
    if (!macro) return res.status(404).json({ message: 'Macro não encontrada' });
    res.json(macro);
  } catch (err) {
    console.error('[macros] GET /:id:', err);
    return deskConfigUnavailable(res);
  }
});

router.post('/', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const macro = await createMacro(req.body, actorName(req));
    res.status(201).json(macro);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

router.put('/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const macro = await updateMacro(String(req.params.id), req.body, actorName(req));
    if (!macro) return res.status(404).json({ message: 'Macro não encontrada' });
    res.json(macro);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

router.delete('/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const ok = await deleteMacro(String(req.params.id));
    if (!ok) return res.status(404).json({ message: 'Macro não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[macros] DELETE /:id:', err);
    return deskConfigUnavailable(res);
  }
});

export default router;
