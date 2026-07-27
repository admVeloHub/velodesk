/** mailRules.routes v1.0.0 — CRUD mail_ignorado / mail_spam / mail_priority */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { supervisorMiddleware } from '../middleware/supervisor';
import { isDeskConfigConnected } from '../config/database';
import {
  createMailRule,
  deleteMailRule,
  listMailRules,
  patchMailRule,
  type MailRulesListKey,
} from '../services/mailRules.service';

const router = Router();

const LIST_KEYS = new Set<MailRulesListKey>(['ignorado', 'spam', 'priority']);

function actorName(req: Request): string {
  return req.user?.name || req.user?.email || 'sistema';
}

function parseListKey(raw: string): MailRulesListKey | null {
  const key = String(raw ?? '').trim().toLowerCase();
  return LIST_KEYS.has(key as MailRulesListKey) ? (key as MailRulesListKey) : null;
}

function deskConfigUnavailable(res: Response) {
  return res.status(503).json({ message: 'Configuração de e-mail indisponível' });
}

router.get('/:list', authMiddleware, async (req, res: Response) => {
  try {
    const list = parseListKey(String(req.params.list));
    if (!list) return res.status(400).json({ message: 'Lista inválida' });
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);
    const items = await listMailRules(list);
    return res.json({ list, items });
  } catch (err) {
    console.error('[mailRules] GET /:list', err);
    return deskConfigUnavailable(res);
  }
});

router.post('/:list', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const list = parseListKey(String(req.params.list));
    if (!list) return res.status(400).json({ message: 'Lista inválida' });
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);

    const item = await createMailRule(
      list,
      {
        type: req.body?.type,
        value: req.body?.value,
        note: req.body?.note,
      },
      actorName(req),
    );
    return res.status(201).json(item);
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg.includes('já cadastrada') ? 409 : 400;
    return res.status(status).json({ message: msg });
  }
});

router.patch('/:list/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const list = parseListKey(String(req.params.list));
    if (!list) return res.status(400).json({ message: 'Lista inválida' });
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);

    const item = await patchMailRule(
      list,
      String(req.params.id),
      {
        active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
        note: req.body?.note,
      },
      actorName(req),
    );
    if (!item) return res.status(404).json({ message: 'Regra não encontrada' });
    return res.json(item);
  } catch (err) {
    return res.status(400).json({ message: (err as Error).message });
  }
});

router.delete('/:list/:id', authMiddleware, supervisorMiddleware, async (req, res: Response) => {
  try {
    const list = parseListKey(String(req.params.list));
    if (!list) return res.status(400).json({ message: 'Lista inválida' });
    if (!isDeskConfigConnected()) return deskConfigUnavailable(res);

    const ok = await deleteMailRule(list, String(req.params.id));
    if (!ok) return res.status(404).json({ message: 'Regra não encontrada' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[mailRules] DELETE /:list/:id', err);
    return deskConfigUnavailable(res);
  }
});

export default router;
