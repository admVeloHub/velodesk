/**
 * Rotas de mesclagem de tickets (estilo Ouvidoria)
 * VERSION: v1.0.1 | DATE: 2026-08-04
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { ChamadoClosedError } from '../services/chamado.mapper';
import {
  executeTicketFusao,
  PermissionDeniedError,
  TicketFusaoError,
} from '../services/ticketFusao.service';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ success: false, message: 'MongoDB indisponível' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const activeId = String(body.activeId || '').trim();
    const cpf = String(body.cpf || '').trim();
    const inactiveIds = Array.isArray(body.inactiveIds)
      ? body.inactiveIds.map((id) => String(id))
      : [];

    const result = await executeTicketFusao(req.user, { activeId, inactiveIds, cpf });

    return res.json({
      success: true,
      active: result.active,
      inativos: result.inativos,
      source: 'ticket_fusao',
    });
  } catch (err) {
    if (err instanceof TicketFusaoError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    if (err instanceof ChamadoClosedError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    if (err instanceof PermissionDeniedError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('[ticket-fusao] falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao mesclar tickets' });
  }
});

export default router;
