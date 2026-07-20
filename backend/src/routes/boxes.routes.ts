/** boxes.routes v1.4.0 — filtro por função RBAC */
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { Box } from '../models/Box';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import {
  atribuidoFuncaoFilter,
  buildChamadoQueryFilter,
  buildResponsavelCandidates,
  chamadoToTicket,
  MEUS_CHAMADOS_COLUMNS,
  statusFromBoxName,
} from '../services/chamado.mapper';
import {
  hasPermission,
  resolveUserPermissions,
  shouldUseMeusChamadosFilter,
} from '../services/permission.service';

const router = Router();

async function resolveDbUser(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select('name email');
}

function resolveQueueMode(resolved: Awaited<ReturnType<typeof resolveUserPermissions>>, queueParam?: string) {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) {
    return { queue: queueParam, extraFilter: undefined as Record<string, unknown> | undefined };
  }
  if (resolved.funcaoSlug === 'financeiro' || resolved.funcoes.includes('financeiro')) {
    return { queue: 'funcao-atribuido', extraFilter: atribuidoFuncaoFilter('financeiro') };
  }
  if (shouldUseMeusChamadosFilter(resolved)) {
    return { queue: 'meus-chamados', extraFilter: undefined };
  }
  return { queue: queueParam, extraFilter: undefined };
}

router.get('/', authMiddleware, async (req, res: Response) => {
  const queueParam = typeof req.query.fila === 'string' ? req.query.fila : undefined;
  const userId = req.user?.userId;

  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Banco de chamados indisponível' });
    }
    const dbUser = await resolveDbUser(userId);
    const resolved = await resolveUserPermissions(req.user!);
    const responsavelCandidates = buildResponsavelCandidates(req.user!, dbUser);
    const { queue, extraFilter } = resolveQueueMode(resolved, queueParam);

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
        const filter = buildChamadoQueryFilter(status, queue, responsavelCandidates, extraFilter);
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
    res.status(500).json({ message: 'Erro ao carregar boxes' });
  }
});

export default router;
