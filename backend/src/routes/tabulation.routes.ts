/** tabulation.routes v1.3.0 — CRUD tabulacao_opcoes (tipo/canal) */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supervisorMiddleware } from '../middleware/supervisor';
import { isDeskConfigConnected } from '../config/database';
import {
  createProduto,
  getActiveTabulation,
  getProdutoById,
  invalidateTabulationCache,
  listProdutos,
  patchProduto,
  replaceProduto,
  deleteProduto,
} from '../services/tabulation.service';
import {
  createOpcaoItem,
  deleteOpcaoItem,
  getOpcoesByCategoria,
  listOpcoes,
  updateOpcaoItem,
} from '../services/tabulationOpcoes.service';

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

router.get('/opcoes', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const includeInactive = req.query.includeInactive === 'true';
    const opcoes = await listOpcoes(includeInactive);
    res.json(opcoes);
  } catch (err) {
    console.error('[tabulation] GET /opcoes:', err);
    return deskConfigUnavailable(res);
  }
});

router.get('/opcoes/:categoria', authMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const includeInactive = req.query.includeInactive === 'true';
    const doc = await getOpcoesByCategoria(String(req.params.categoria), includeInactive);
    if (!doc) return res.status(404).json({ message: 'Categoria não encontrada' });
    res.json(doc);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('inválida')) return res.status(400).json({ message: msg });
    console.error('[tabulation] GET /opcoes/:categoria:', err);
    return deskConfigUnavailable(res);
  }
});

router.post('/opcoes/:categoria/items', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const doc = await createOpcaoItem(String(req.params.categoria), req.body, actorName(req));
    invalidateTabulationCache();
    res.status(201).json(doc);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('já cadastrada') ? 409 : msg.includes('inválida') ? 400 : 400;
    res.status(status).json({ message: msg });
  }
});

router.patch('/opcoes/:categoria/items/:itemId', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const doc = await updateOpcaoItem(
      String(req.params.categoria),
      String(req.params.itemId),
      req.body,
      actorName(req)
    );
    if (!doc) return res.status(404).json({ message: 'Opção não encontrada' });
    invalidateTabulationCache();
    res.json(doc);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('já cadastrada') ? 409 : msg.includes('inválida') ? 400 : 400;
    res.status(status).json({ message: msg });
  }
});

router.delete('/opcoes/:categoria/items/:itemId', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const ok = await deleteOpcaoItem(String(req.params.categoria), String(req.params.itemId));
    if (!ok) return res.status(404).json({ message: 'Opção não encontrada' });
    invalidateTabulationCache();
    res.json({ ok: true });
  } catch (err) {
    console.error('[tabulation] DELETE /opcoes/:categoria/items/:itemId:', err);
    return deskConfigUnavailable(res);
  }
});

export default router;
