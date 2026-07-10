/** workspace360.routes v1.0.0 — Painel 360° sobre chamados_n1 */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
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

router.get('/', authMiddleware, async (req, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }

  try {
    const role = String(req.user?.role ?? '').trim().toLowerCase();
    const query = parseQuery(req);

    if (query.report && role === 'supervisor') {
      const report = await buildReportPayload(req.user!, query);
      if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
      return res.json({ report });
    }

    if (role === 'supervisor') {
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
