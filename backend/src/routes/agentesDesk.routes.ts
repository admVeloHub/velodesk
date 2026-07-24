/** agentesDesk.routes v1.3.0 — GET lê VeloHub ao vivo (espelho é secundário) */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireGestaoOrPermission } from '../middleware/permission';
import {
  listAgentesDeskFresh,
  syncAgentesFromVelohub,
  listAgentesDesk,
} from '../services/agenteDesk.service';

const router = Router();

router.get(
  '/',
  authMiddleware,
  requireGestaoOrPermission('config', 'visualizar'),
  async (req, res: Response) => {
    try {
      const updatedBy = req.user?.email || req.user?.name || 'auto';
      const result = await listAgentesDeskFresh(updatedBy);
      res.json(result.agentes);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/indisponível|unavailable/i.test(message)) {
        return res.status(503).json({ message });
      }
      res.status(500).json({ message });
    }
  },
);

router.post(
  '/sync',
  authMiddleware,
  requireGestaoOrPermission('config', 'visualizar'),
  async (req, res: Response) => {
    try {
      const updatedBy = req.user?.email || req.user?.name || 'system';
      const result = await syncAgentesFromVelohub(updatedBy);
      const agentes = await listAgentesDesk();
      res.json({ ...result, agentes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/indisponível|unavailable|console_funcionarios/i.test(message)) {
        return res.status(503).json({ message: 'VeloHub indisponível para sincronização.' });
      }
      res.status(500).json({ message });
    }
  },
);

export default router;
