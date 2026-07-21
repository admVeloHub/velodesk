/** aiUsage.routes v1.0.0 — relatório de custo/tokens de IA para o painel de Gestão */
import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { env } from '../config/env';
import { getAiUsageDailyReport } from '../services/aiUsage.service';
import { GestaoInsightsQuery } from '../services/gestaoInsights.service';

const router = Router();

function parseQuery(req: Request): GestaoInsightsQuery {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
  };
}

/** Mesma regra dos demais cards de Gestão: fora de produção, qualquer perfil autenticado pode visualizar. */
function requireSupervisorInProduction(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor' && env.nodeEnv === 'production') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}

router.use(authMiddleware, requireSupervisorInProduction);

router.get('/report', async (req: Request, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco indisponível' });
  }
  try {
    const result = await getAiUsageDailyReport(parseQuery(req));
    return res.json(result);
  } catch (err) {
    console.error('[ai-usage] GET /report falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar relatório de uso de IA' });
  }
});

export default router;
