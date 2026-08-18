/** gestaoInsights.routes v1.2.0 — cards analíticos + GET /painel unificado; voz-cliente congelado */
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { env } from '../config/env';
import {
  getCasoEspecialDetail,
  getCasosEspeciais,
  getTopMotivosPorProduto,
  getVolumeSeries,
  getVolumeSummary,
  GestaoInsightsQuery,
} from '../services/gestaoInsights.service';
import { getGestaoInsightsPainel } from '../services/gestaoInsightsPainel.service';
import {
  getRiscosCasoEspecial,
} from '../services/chamadoIaAnalise.service';

const VOZ_CLIENTE_FROZEN = {
  message: 'Visão do cliente por IA em desenvolvimento',
  frozen: true,
};

const router = Router();

function parseQuery(req: Request): GestaoInsightsQuery & { granularity?: string } {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    granularity: typeof req.query.granularity === 'string' ? req.query.granularity : undefined,
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

router.get('/painel', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }
  try {
    const result = await getGestaoInsightsPainel(parseQuery(req));
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /painel falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar painel analítico da gestão' });
  }
});

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

router.get('/casos-especiais/:orgao', async (req: Request, res: Response) => {
  try {
    const compare = typeof req.query.compare === 'string' ? req.query.compare : undefined;
    const result = await getCasoEspecialDetail(req.params.orgao, { ...parseQuery(req), compare });
    if (!result) {
      return res.status(404).json({ message: 'Órgão/canal não encontrado' });
    }
    return res.json(result);
  } catch (err) {
    console.error('[gestao-insights] GET /casos-especiais/:orgao falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar detalhe de casos especiais' });
  }
});

router.get('/risco-casos-especiais', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }
  try {
    const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const result = await getRiscosCasoEspecial(limit);
    return res.json({ items: result });
  } catch (err) {
    console.error('[gestao-insights] GET /risco-casos-especiais falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar risco de casos especiais' });
  }
});

/** Congelado — card em desenvolvimento; evita consulta pesada em chamados_n1.registro. */
router.get('/voz-cliente', (_req: Request, res: Response) => {
  return res.status(503).json(VOZ_CLIENTE_FROZEN);
});

router.get('/voz-cliente/tickets', (_req: Request, res: Response) => {
  return res.status(503).json({ ...VOZ_CLIENTE_FROZEN, items: [] });
});

export default router;
