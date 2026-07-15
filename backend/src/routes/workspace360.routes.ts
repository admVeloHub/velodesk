/** workspace360.routes v1.1.0 — Painel 360° com suporte a profile=gestao|agent */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { env } from '../config/env';
import { User } from '../models/User';
import {
  buildAgent360Payload,
  buildReportPayload,
  buildSupervisor360Payload,
  Workspace360Query,
} from '../services/workspace360.service';

const router = Router();

function parseQuery(req: { query: Record<string, unknown> }): Workspace360Query {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
    team: typeof req.query.team === 'string' ? req.query.team : undefined,
    report: typeof req.query.report === 'string' ? req.query.report : undefined,
  };
}

function wantsSupervisorPayload(req: { query: Record<string, unknown> }, role: string): boolean {
  const profile = String(req.query.profile ?? '').trim().toLowerCase();
  if (profile === 'gestao' || profile === 'supervisor') return true;
  if (profile === 'agent') return false;
  return role === 'supervisor';
}

router.get('/', authMiddleware, async (req, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }

  try {
    const role = String(req.user?.role ?? '').trim().toLowerCase();
    const query = parseQuery(req);
    const supervisorView = wantsSupervisorPayload(req, role);

    if (query.report && supervisorView) {
      const report = await buildReportPayload(req.user!, query);
      if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
      return res.json({ report });
    }

    if (supervisorView) {
      if (role !== 'supervisor' && env.nodeEnv === 'production') {
        return res.status(403).json({ message: 'Perfil Gestão requer permissão de supervisor.' });
      }
      const payload = await buildSupervisor360Payload(req.user!, query);
      return res.json(payload);
    }

    const payload = await buildAgent360Payload(req.user!);
    return res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[workspace360] GET falhou:', message);
    return res.status(500).json({ message: 'Erro ao carregar Painel 360°' });
  }
});

router.get('/agents', authMiddleware, async (req, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco indisponível' });
  }
  try {
    const users = await User.find({ role: { $in: ['agent', 'supervisor'] } })
      .select('name email role')
      .sort({ name: 1 })
      .lean();
    res.json(
      users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[workspace360] GET /agents falhou:', message);
    res.status(500).json({ message: 'Erro ao listar agentes' });
  }
});

export default router;
