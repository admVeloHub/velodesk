/** workspace360.routes v1.2.0 — RBAC por função */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import {
  buildAgent360Payload,
  buildReportPayload,
  buildSupervisor360Payload,
  Workspace360Query,
} from '../services/workspace360.service';
import { hasPermission, resolveUserPermissions } from '../services/permission.service';

const router = Router();

function parseQuery(req: { query: Record<string, unknown> }): Workspace360Query {
  return {
    period: typeof req.query.period === 'string' ? req.query.period : undefined,
    channel: typeof req.query.channel === 'string' ? req.query.channel : undefined,
    team: typeof req.query.team === 'string' ? req.query.team : undefined,
    report: typeof req.query.report === 'string' ? req.query.report : undefined,
  };
}

function wantsSupervisorPayload(
  req: { query: Record<string, unknown> },
  hasEquipe: boolean,
): boolean {
  const profile = String(req.query.profile ?? '').trim().toLowerCase();
  if (profile === 'gestao' || profile === 'supervisor') return hasEquipe;
  if (profile === 'agent') return false;
  return hasEquipe;
}

router.get('/', authMiddleware, async (req, res: Response) => {
  if (!isMongoConnected()) {
    return res.status(503).json({ message: 'Banco de chamados indisponível' });
  }

  try {
    const resolved = await resolveUserPermissions(req.user!);
    const hasEquipe = hasPermission(resolved.permissoes, 'workspace', 'painel_360_equipe');
    const query = parseQuery(req);
    const supervisorView = wantsSupervisorPayload(req, hasEquipe);

    if (query.report && supervisorView) {
      const report = await buildReportPayload(req.user!, query);
      if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
      return res.json({ report });
    }

    if (supervisorView) {
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
    const resolved = await resolveUserPermissions(req.user!);
    if (!hasPermission(resolved.permissoes, 'workspace', 'painel_360_equipe')) {
      return res.status(403).json({ message: 'Sem permissão para listar agentes' });
    }
    const { User } = await import('../models/User');
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
