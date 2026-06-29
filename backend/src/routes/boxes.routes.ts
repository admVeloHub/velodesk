/** boxes.routes v1.3.5 — Kanban via collection boxes (sem seed automático) */
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { Box } from '../models/Box';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import {
  buildChamadoQueryFilter,
  buildResponsavelCandidates,
  chamadoToTicket,
  MEUS_CHAMADOS_COLUMNS,
  statusFromBoxName,
} from '../services/chamado.mapper';

const router = Router();

async function resolveDbUser(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select('name email');
}

router.get('/', authMiddleware, async (req, res: Response) => {
  const queue = typeof req.query.fila === 'string' ? req.query.fila : undefined;
  const userId = req.user?.userId;

  try {
    const dbUser = await resolveDbUser(userId);
    const responsavelCandidates = buildResponsavelCandidates(req.user!, dbUser);

    if (queue === 'meus-chamados') {
      const result = await Promise.all(
        MEUS_CHAMADOS_COLUMNS.map(async (column) => {
          const filter = buildChamadoQueryFilter(column.status, queue, responsavelCandidates);
          const chamados = await ChamadoN1.find(filter).sort({ updatedAt: -1 });
          return {
            id: column.id,
            name: column.name,
            order: column.order,
            tickets: await Promise.all(
              chamados.map((chamado) => chamadoToTicket(chamado, column.id))
            ),
          };
        })
      );
      return res.json(result);
    }

    const boxes = await Box.find().sort({ order: 1 });
    const result = await Promise.all(
      boxes.map(async (box) => {
        const status = statusFromBoxName(box.name);
        const filter = buildChamadoQueryFilter(status, queue, responsavelCandidates);
        const chamados = await ChamadoN1.find(filter).sort({ updatedAt: -1 });
        return {
          id: box.id,
          name: box.name,
          order: box.order,
          tickets: await Promise.all(
            chamados.map((chamado) => chamadoToTicket(chamado, box._id.toString()))
          ),
        };
      })
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[boxes] GET falhou:', message);
    res.status(500).json({ message: 'Erro ao carregar kanban' });
  }
});

export default router;
