/** ticketIaAnalysis.routes v1.0.0 — configuração e aprendizado da visão do cliente */
import { NextFunction, Request, Response, Router } from 'express';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';
import { TicketIaExemplo } from '../models/TicketIaExemplo';
import {
  correctChamadoIaReason,
  markChamadoIaForReanalysis,
  markChamadosIaForReanalysis,
} from '../services/chamadoIaAnalise.service';
import {
  ensureTicketIaSettings,
  updateTicketIaSettings,
} from '../services/ticketIaSettings.service';

const router = Router();

function requireSupervisorInProduction(req: Request, res: Response, next: NextFunction) {
  const role = String(req.user?.role ?? '').trim().toLowerCase();
  if (role !== 'supervisor' && env.nodeEnv === 'production') {
    return res.status(403).json({ message: 'Acesso restrito a supervisores' });
  }
  next();
}

router.use(authMiddleware, requireSupervisorInProduction);

router.get('/settings', async (_req, res) => {
  const settings = await ensureTicketIaSettings();
  const examples = await TicketIaExemplo.find({ ativo: true }).sort({ updatedAt: -1 }).lean();
  res.json({ settings, examples });
});

router.put('/settings', async (req, res) => {
  try {
    const settings = await updateTicketIaSettings(req.body ?? {}, req.user?.userId);
    res.json(settings);
  } catch (err) {
    console.error('[ticket-ia-analysis] settings:', err);
    res.status(400).json({ message: (err as Error).message });
  }
});

router.patch('/examples/:id', async (req, res) => {
  const example = await TicketIaExemplo.findByIdAndUpdate(
    req.params.id,
    { $set: { ativo: req.body?.ativo !== false } },
    { new: true },
  );
  if (!example) return res.status(404).json({ message: 'Exemplo não encontrado' });
  res.json(example);
});

router.post('/reanalyze', async (req, res) => {
  const chamadoIds = Array.isArray(req.body?.chamadoIds)
    ? req.body.chamadoIds.map(String)
    : req.body?.chamadoId
      ? [String(req.body.chamadoId)]
      : [];
  if (!chamadoIds.length) return res.status(400).json({ message: 'Informe um ou mais tickets.' });
  if (chamadoIds.length === 1) await markChamadoIaForReanalysis(chamadoIds[0]);
  else await markChamadosIaForReanalysis(chamadoIds);
  res.json({ ok: true, total: chamadoIds.length });
});

router.post('/correct-reason', async (req, res) => {
  try {
    const chamadoIds = Array.isArray(req.body?.chamadoIds)
      ? req.body.chamadoIds.map(String)
      : req.body?.chamadoId
        ? [String(req.body.chamadoId)]
        : [];
    const result = await correctChamadoIaReason({
      chamadoIds,
      motivo: String(req.body?.motivo ?? ''),
      promoteTaxonomy: Boolean(req.body?.promoteTaxonomy),
      createAliasFrom: req.body?.createAliasFrom
        ? String(req.body.createAliasFrom)
        : undefined,
      userId: req.user?.userId,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

export default router;
