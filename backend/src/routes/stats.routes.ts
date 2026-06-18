/** stats.routes v1.1.0 — agregação sobre chamados_n1 */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ChamadoN1 } from '../models/ChamadoN1';
import { Box } from '../models/Box';
import { User } from '../models/User';
import { lastStatusFilter } from '../services/chamado.mapper';

const router = Router();

async function buildStats(_req: unknown, res: Response) {
  const [total, resolved, pending, boxes, agents] = await Promise.all([
    ChamadoN1.countDocuments(),
    ChamadoN1.countDocuments(lastStatusFilter('resolvido')),
    ChamadoN1.countDocuments({
      $expr: {
        $in: [
          { $arrayElemAt: ['$registro.status', -1] },
          ['novo', 'em-aberto', 'pendente', 'em-espera'],
        ],
      },
    }),
    Box.countDocuments(),
    User.countDocuments(),
  ]);
  res.json({ total, resolved, pending, boxes, agents });
}

router.get('/dashboard', authMiddleware, buildStats);
router.get('/stats', authMiddleware, buildStats);

export default router;
