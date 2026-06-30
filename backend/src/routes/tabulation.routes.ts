/** tabulation.routes v1.2.1 — 503 se desk_config indisponível (não derruba API) */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supervisorMiddleware } from '../middleware/supervisor';
import { isDeskConfigConnected } from '../config/database';
import {
  createProduto,
  getActiveTabulation,
  getProdutoById,
  listProdutos,
  patchProduto,
  replaceProduto,
  deleteProduto,
} from '../services/tabulation.service';

const router = Router();

function actorName(req: Request): string {
  return req.user?.name || req.user?.email || 'sistema';
}

function deskConfigUnavailable(res: Response) {
  return res.status(503).json({ message: 'Configuração de tabulação indisponível' });
}

router.get('/', authMiddleware, async (_req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const data = await getActiveTabulation();
    res.json(data);
  } catch (err) {
    console.error('[tabulation] GET /:', err);
    return deskConfigUnavailable(res);
  }
});

router.get('/produtos', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const includeInactive = req.query.includeInactive === 'true';
    const produtos = await listProdutos(includeInactive);
    res.json(produtos);
  } catch (err) {
    console.error('[tabulation] GET /produtos:', err);
    return deskConfigUnavailable(res);
  }
});

router.get('/produtos/:id', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const produto = await getProdutoById(String(req.params.id));
    if (!produto) return res.status(404).json({ message: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    console.error('[tabulation] GET /produtos/:id:', err);
    return deskConfigUnavailable(res);
  }
});

router.post('/produtos', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const produto = await createProduto(req.body, actorName(req));
    res.status(201).json(produto);
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.includes('já cadastrado') ? 409 : 400).json({ message: msg });
  }
});

router.put('/produtos/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const produto = await replaceProduto(String(req.params.id), req.body, actorName(req));
    if (!produto) return res.status(404).json({ message: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.includes('já cadastrado') ? 409 : 400).json({ message: msg });
  }
});

router.patch('/produtos/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const produto = await patchProduto(String(req.params.id), req.body, actorName(req));
    if (!produto) return res.status(404).json({ message: 'Produto não encontrado' });
    res.json(produto);
  } catch (err) {
    const msg = (err as Error).message;
    res.status(msg.includes('já cadastrado') ? 409 : 400).json({ message: msg });
  }
});

router.delete('/produtos/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const ok = await deleteProduto(String(req.params.id));
    if (!ok) return res.status(404).json({ message: 'Produto não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[tabulation] DELETE /produtos/:id:', err);
    return deskConfigUnavailable(res);
  }
});

export default router;
