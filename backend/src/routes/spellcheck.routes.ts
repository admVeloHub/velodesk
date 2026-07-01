/** spellcheck.routes v1.0.0 — proxy LanguageTool self-hosted para o compose */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  checkLanguageToolHealth,
  checkTextWithLanguageTool,
  isLanguageToolConfigured,
} from '../services/languagetool.service';

const router = Router();

router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  if (!isLanguageToolConfigured()) {
    return res.json({
      configured: false,
      available: false,
    });
  }
  const available = await checkLanguageToolHealth();
  return res.json({
    configured: true,
    available,
  });
});

router.post('/check', authMiddleware, async (req: Request, res: Response) => {
  const text = String(req.body?.text || '');
  const ignoredWords = Array.isArray(req.body?.ignoredWords) ? req.body.ignoredWords : [];
  const whitelist = Array.isArray(req.body?.whitelist) ? req.body.whitelist : [];

  if (!text.trim()) {
    return res.json({ available: true, errors: [] });
  }

  const result = await checkTextWithLanguageTool(text, whitelist, ignoredWords);
  return res.json(result);
});

export default router;
