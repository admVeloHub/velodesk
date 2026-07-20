/** tickets.routes v1.5.0 — POST /:id/workflow/advance */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ChamadoN1 } from '../models/ChamadoN1';
import { Box } from '../models/Box';
import { applySessionResponsavelIfNeeded } from '../services/assignmentRouter.service';
import {
  appendRegistroEntry,
  applyBodyToChamado,
  chamadoToTicket,
  createChamadoFromBody,
  lastStatusFilter,
  resolveBoxIdForChamado,
  statusFromBoxName,
} from '../services/chamado.mapper';
import { TabulacaoValidationError } from '../services/tabulation.service';
import { notifyAgentReplyAsync, notifyTicketOpenedAsync } from '../services/emailNotification.service';
import {
  advanceWorkflowManual,
  advanceWorkflowWithDecision,
  setWorkflowPendingDecision,
  tryActivateWorkflowOnTabulation,
  WorkflowAdvanceError,
} from '../services/workflowTicket.service';
import {
  assertCanActOnTicket,
  PermissionDeniedError,
} from '../services/permission.service';

const router = Router();

async function loadBoxes() {
  return Box.find().sort({ order: 1 });
}

router.get('/', authMiddleware, async (req, res: Response) => {
  const boxes = await loadBoxes();
  const filter: Record<string, unknown> = {};

  if (req.query.boxId) {
    const box = boxes.find((b) => b._id.toString() === String(req.query.boxId));
    if (box) Object.assign(filter, lastStatusFilter(statusFromBoxName(box.name)));
  } else if (req.query.status) {
    Object.assign(filter, lastStatusFilter(String(req.query.status)));
  }

  const chamados = await ChamadoN1.find(filter).sort({ updatedAt: -1 });
  const tickets = await Promise.all(
    chamados.map(async (chamado) =>
      chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes))
    )
  );
  res.json(tickets);
});

router.get('/by-protocol/:protocolo', authMiddleware, async (req, res: Response) => {
  const protocolo = String(req.params.protocolo ?? '').trim();
  if (!protocolo) return res.status(400).json({ message: 'Protocolo inválido' });

  const chamado = await ChamadoN1.findOne({ chamadoProtocolo: protocolo });
  if (!chamado) return res.status(404).json({ message: 'Chamado não encontrado' });

  const boxes = await loadBoxes();
  res.json(await chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes)));
});

router.get('/:id', authMiddleware, async (req, res: Response) => {
  const chamado = await ChamadoN1.findById(req.params.id);
  if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });
  const boxes = await loadBoxes();
  res.json(await chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes)));
});

router.post('/', authMiddleware, async (req, res: Response) => {
  const boxes = await loadBoxes();
  let status = 'novo';

  if (req.body.status !== undefined && String(req.body.status).trim()) {
    status = String(req.body.status);
  } else if (req.body.boxId) {
    const box = boxes.find((b) => b._id.toString() === String(req.body.boxId));
    if (box) status = statusFromBoxName(box.name);
  } else if (boxes[0]) {
    status = statusFromBoxName(boxes[0].name);
  }

  const protocolo = String(req.body.chamadoProtocolo ?? '').trim();
  if (protocolo) {
    const exists = await ChamadoN1.findOne({ chamadoProtocolo: protocolo });
    if (exists) {
      return res.status(409).json({ message: 'Protocolo já cadastrado' });
    }
  }

  try {
    const partial = await createChamadoFromBody(req.body, status, req.user);
    applySessionResponsavelIfNeeded(partial, req.user);
    const chamado = await ChamadoN1.create(partial);
    await notifyTicketOpenedAsync(chamado);
    const ticket = await chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes));
    res.status(201).json(ticket);
  } catch (err) {
    if (err instanceof TabulacaoValidationError) {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
});

router.put('/:id', authMiddleware, async (req, res: Response) => {
  const chamado = await ChamadoN1.findById(req.params.id);
  if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });

  try {
    await assertCanActOnTicket(req.user!, chamado);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }

  if (req.body.boxId && (req.body.status === undefined || String(req.body.status).trim() === '')) {
    const box = await Box.findById(req.body.boxId);
    if (box) req.body.status = statusFromBoxName(box.name);
  }

  if (!String(req.body.author ?? '').trim() && req.user) {
    req.body.author = req.user.name || req.user.email || '';
  }

  try {
    await applyBodyToChamado(chamado, req.body, req.user);
    await tryActivateWorkflowOnTabulation(
      chamado,
      String(req.body.author ?? req.user?.name ?? req.user?.email ?? 'Sistema'),
    );
    await chamado.save();

    const boxes = await loadBoxes();
    res.json(await chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes)));
  } catch (err) {
    if (err instanceof TabulacaoValidationError) {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
});

router.delete('/:id', authMiddleware, async (req, res: Response) => {
  const chamado = await ChamadoN1.findByIdAndDelete(req.params.id);
  if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });
  res.json({ success: true });
});

router.post('/:id/messages', authMiddleware, async (req, res: Response) => {
  const { text, sender, internal, attachments, internalText, anotacaoInterna, author } = req.body;
  const chamado = await ChamadoN1.findById(req.params.id);
  if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });

  try {
    await assertCanActOnTicket(req.user!, chamado);
  } catch (err) {
    if (err instanceof PermissionDeniedError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }

  const attachmentList = Array.isArray(attachments)
    ? attachments.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
    : [];

  const isInternalOnly = Boolean(internal);
  const publicText = isInternalOnly ? '' : String(text ?? '');
  const noteText = isInternalOnly
    ? String(text ?? '')
    : String(internalText ?? anotacaoInterna ?? '');

  const result = appendRegistroEntry(chamado, {
    mensagemPublica: publicText,
    anotacaoInterna: noteText,
    anexosMensagemPublica: isInternalOnly ? [] : attachmentList,
    anexosAnotacaoInterna: isInternalOnly ? attachmentList : [],
    sender: sender || 'me',
    autor: String(author ?? req.user?.name ?? req.user?.email ?? '').trim() || undefined,
    authUser: req.user,
  });

  if (!result.public && !result.internal) {
    return res.status(400).json({ message: 'Texto da mensagem ou anotação é obrigatório' });
  }

  await chamado.save();

  if (!isInternalOnly && publicText.trim()) {
    await notifyAgentReplyAsync(chamado, publicText, undefined, result.public?.registroIndex);
    await chamado.save();
  }

  res.status(201).json({
    ...(result.public ?? result.internal),
    publicMessage: result.public,
    internalNote: result.internal,
  });
});

router.post('/:id/workflow/advance', authMiddleware, async (req, res: Response) => {
  const chamado = await ChamadoN1.findById(req.params.id);
  if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });

  const decision = req.body?.decision;
  try {
    if (decision === 'approve' || decision === 'reject') {
      await advanceWorkflowWithDecision(chamado, decision, req.user);
    } else if (req.body?.pendingDecision === 'approve' || req.body?.pendingDecision === 'reject') {
      setWorkflowPendingDecision(chamado, req.body.pendingDecision);
      await advanceWorkflowManual(chamado, req.user);
    } else {
      await advanceWorkflowManual(chamado, req.user);
    }
    await chamado.save();
    const boxes = await loadBoxes();
    res.json(await chamadoToTicket(chamado, await resolveBoxIdForChamado(chamado, boxes)));
  } catch (err) {
    if (err instanceof WorkflowAdvanceError) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
});

export default router;
