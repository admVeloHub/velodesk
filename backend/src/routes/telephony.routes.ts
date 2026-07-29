/** telephony.routes v1.0.0 — API interna JWT para ligações e recados emergenciais */
import { NextFunction, Request, Response, Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import {
  getTelephonyCallDetail,
  getTelephonyCallsStats,
  getTelephonyIntegrationInfo,
  listTelephonyCalls,
} from '../services/telephony.service';
import {
  createRecado,
  deleteRecado,
  listAllRecados,
  updateRecado,
  countActiveRecados,
  getLatestActiveRecadoUpdatedAt,
} from '../services/telephonyRecado.service';
import { getPartnerPayloadExample } from '../services/telephony-inbound/telephonyInbound.service';

const router = Router();

function requireSupervisorInProduction(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor' && env.nodeEnv === 'production') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}

function requireSupervisorForWrite(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor') {
    return res.status(403).json({ message: 'Somente supervisores podem alterar recados emergenciais' });
  }
  next();
}

router.use(authMiddleware);

router.get('/integration-info', requireSupervisorInProduction, (req: Request, res: Response) => {
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol);
  const host = String(req.headers['x-forwarded-host'] ?? req.get('host') ?? 'localhost:8001');
  const baseUrl = `${proto}://${host}`;
  res.json({
    ...getTelephonyIntegrationInfo(baseUrl),
    enabled: env.inboundTelephonyEnabled,
    secretConfigured: Boolean(env.inboundTelephonyWebhookSecret),
    autoCreateTicket: env.telephonyAutoCreateTicket,
    payloadExample: getPartnerPayloadExample(),
  });
});

function queryFromRequest(req: Request) {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    phone: typeof req.query.phone === 'string' ? req.query.phone : undefined,
    cpf: typeof req.query.cpf === 'string' ? req.query.cpf : undefined,
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    direction: typeof req.query.direction === 'string' ? req.query.direction : undefined,
    agent: typeof req.query.agent === 'string' ? req.query.agent : undefined,
    converted: typeof req.query.converted === 'string' ? req.query.converted : undefined,
  };
}

router.get('/calls/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getTelephonyCallsStats(queryFromRequest(req));
    return res.json(stats);
  } catch (err) {
    console.error('[telephony] GET /calls/stats falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar estatísticas' });
  }
});

router.get('/calls', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
    const limit = parseInt(String(req.query.limit ?? '25'), 10) || 25;
    const result = await listTelephonyCalls({
      ...queryFromRequest(req),
      page,
      limit,
    });
    return res.json(result);
  } catch (err) {
    console.error('[telephony] GET /calls falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar ligações' });
  }
});

router.get('/calls/:id', async (req: Request, res: Response) => {
  try {
    const detail = await getTelephonyCallDetail(req.params.id);
    if (!detail) return res.status(404).json({ message: 'Ligação não encontrada' });
    return res.json(detail);
  } catch (err) {
    console.error('[telephony] GET /calls/:id falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar detalhe da ligação' });
  }
});

router.get('/recados', async (_req: Request, res: Response) => {
  try {
    const items = await listAllRecados();
    return res.json({ items });
  } catch (err) {
    console.error('[telephony] GET /recados falhou:', err);
    return res.status(500).json({ message: 'Erro ao carregar recados' });
  }
});

router.post('/recados', requireSupervisorForWrite, async (req: Request, res: Response) => {
  try {
    const created = await createRecado(req.body ?? {}, req.user?.userId);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message });
  }
});

router.patch('/recados/:id', requireSupervisorForWrite, async (req: Request, res: Response) => {
  try {
    const updated = await updateRecado(req.params.id, req.body ?? {}, req.user?.userId);
    if (!updated) return res.status(404).json({ message: 'Recado não encontrado' });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message });
  }
});

router.delete('/recados/:id', requireSupervisorForWrite, async (req: Request, res: Response) => {
  const ok = await deleteRecado(req.params.id);
  if (!ok) return res.status(404).json({ message: 'Recado não encontrado' });
  return res.json({ success: true });
});

export default router;
