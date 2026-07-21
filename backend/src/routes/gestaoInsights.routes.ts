/** gestaoInsights.routes v1.1.0 — cards analíticos da Gestão (volume, motivos, casos especiais) */
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { env } from '../config/env';
import {
  getCasosEspeciais,
  getTopMotivosPorProduto,
  getVolumeSeries,
  getVolumeSummary,
  GestaoInsightsQuery,
} from '../services/gestaoInsights.service';

const router = Router();

function parseQuery(req: Request): GestaoInsightsQuery {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  };
}

/** Mesma regra do workspace360.routes: fora de produção, qualquer perfil autenticado pode ver a visão Gestão. */
function requireSupervisorInProduction(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor' && env.nodeEnv === 'production') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}

router.use(authMiddleware, requireSupervisorInProduction);

router.get('/volume', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }
  try {
    const result = await getVolumeSeries(parseQuery(req));
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /volume falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar volume de tickets' });
  }
});

router.get('/resumo', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }
  try {
    const result = await getVolumeSummary(parseQuery(req));
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /resumo falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar o resumo de tickets' });
  }
});

router.get('/motivos', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }
  try {
    const limit = Math.max(1, Math.min(10, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const result = await getTopMotivosPorProduto(parseQuery(req), limit);
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /motivos falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar motivos de acionamento' });
  }
});

router.get('/casos-especiais', async (req: Request, res: Response) => {
  try {
    const result = await getCasosEspeciais(parseQuery(req));
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /casos-especiais falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar casos especiais' });
  }
});

export default router;
