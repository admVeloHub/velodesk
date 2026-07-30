/** agentQueueBoxes.routes v1.1.0 — CRUD caixas com criterios[] */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { isDeskPreferencesConnected } from '../config/database';
import {
  createAgentQueueBox,
  deleteAgentQueueBox,
  listAgentQueueBoxes,
  migrateAgentQueueBoxes,
  updateAgentQueueBox,
} from '../services/agentQueueBox.service';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isDeskPreferencesConnected()) {
      return res.status(503).json({ success: false, message: 'desk_preferences indisponível' });
    }
    const email = req.user?.email || '';
    const boxes = await listAgentQueueBoxes(email);
    return res.json({ success: true, boxes, source: 'agent_queue_boxes_list' });
  } catch (err) {
    console.error('[agent-queue-boxes] GET falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao carregar caixas personalizadas' });
  }
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isDeskPreferencesConnected()) {
      return res.status(503).json({ success: false, message: 'desk_preferences indisponível' });
    }
    const email = req.user?.email || '';
    const body = req.body as Record<string, unknown>;
    const box = await createAgentQueueBox(email, req.user?.userId, {
      name: String(body.name || ''),
      action: body.action != null ? String(body.action) : undefined,
      boxId: body.boxId != null ? String(body.boxId) : undefined,
      criterios: body.criterios,
      dot: body.dot != null ? String(body.dot) : undefined,
    });
    return res.status(201).json({ success: true, box, source: 'agent_queue_boxes_create' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar caixa';
    const status = /obrigatório|Informe/i.test(message) ? 400 : 500;
    console.error('[agent-queue-boxes] POST falhou:', err);
    return res.status(status).json({ success: false, message });
  }
});

router.put('/:boxId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isDeskPreferencesConnected()) {
      return res.status(503).json({ success: false, message: 'desk_preferences indisponível' });
    }
    const email = req.user?.email || '';
    const body = req.body as Record<string, unknown>;
    const box = await updateAgentQueueBox(email, req.params.boxId, {
      name: String(body.name || ''),
      action: body.action != null ? String(body.action) : undefined,
      criterios: body.criterios,
      dot: body.dot != null ? String(body.dot) : undefined,
    });
    if (!box) {
      return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
    }
    return res.json({ success: true, box, source: 'agent_queue_boxes_update' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar caixa';
    const status = /obrigatório|Informe/i.test(message) ? 400 : 500;
    console.error('[agent-queue-boxes] PUT falhou:', err);
    return res.status(status).json({ success: false, message });
  }
});

router.post('/migrate', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isDeskPreferencesConnected()) {
      return res.status(503).json({ success: false, message: 'desk_preferences indisponível' });
    }
    const email = req.user?.email || '';
    const raw = req.body?.boxes;
    if (!Array.isArray(raw) || !raw.length) {
      return res.status(400).json({ success: false, message: 'Informe boxes para migrar' });
    }
    const boxes = raw.map((item) => ({
      name: String(item?.name || ''),
      action: String(item?.action || ''),
      boxId: item?.boxId != null ? String(item.boxId) : (item?.id != null ? String(item.id) : undefined),
      criterios: item?.criterios,
    }));
    const created = await migrateAgentQueueBoxes(email, req.user?.userId, boxes);
    const all = await listAgentQueueBoxes(email);
    return res.json({ success: true, migrated: created.length, boxes: all, source: 'agent_queue_boxes_migrate' });
  } catch (err) {
    console.error('[agent-queue-boxes] migrate falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao migrar caixas personalizadas' });
  }
});

router.delete('/:boxId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!isDeskPreferencesConnected()) {
      return res.status(503).json({ success: false, message: 'desk_preferences indisponível' });
    }
    const email = req.user?.email || '';
    const deleted = await deleteAgentQueueBox(email, req.params.boxId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Caixa não encontrada' });
    }
    return res.json({ success: true, deleted: true, source: 'agent_queue_boxes_delete' });
  } catch (err) {
    console.error('[agent-queue-boxes] DELETE falhou:', err);
    return res.status(500).json({ success: false, message: 'Erro ao excluir caixa personalizada' });
  }
});

export default router;
