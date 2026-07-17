/** workflowNotificacoes.routes v1.0.0 */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  countUnreadNotificacoes,
  listNotificacoesForUser,
  markNotificacaoLida,
} from '../services/workflowNotificacao.service';
import { listInternalHookOptions } from '../services/workflowInternalHooks';

const router = Router();

router.get('/', authMiddleware, async (req, res: Response) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ message: 'Não autenticado' });
  const notificacoes = await listNotificacoesForUser(email);
  const unread = await countUnreadNotificacoes(email);
  res.json({ notificacoes, unread });
});

router.patch('/:id/read', authMiddleware, async (req, res: Response) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ message: 'Não autenticado' });
  const ok = await markNotificacaoLida(String(req.params.id), email);
  if (!ok) return res.status(404).json({ message: 'Notificação não encontrada' });
  res.json({ success: true });
});

router.get('/internal-hooks', authMiddleware, (_req, res: Response) => {
  res.json({ hooks: listInternalHookOptions() });
});

export default router;
