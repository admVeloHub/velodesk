/** compose.routes v1.0.3 — nomeOperador sem round-trip Mongo quando já veio na sessão */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { resolveOperadorDisplayNameForAuthEmail } from '../services/colaboradoresCadastro.service';
import {
  generateRefinarRascunhoWithGemini,
  isGeminiRefinarConfigured,
  validateRascunhoInput,
} from '../services/geminiRefinar.service';

const router = Router();

function statusForGeminiError(error?: string): number {
  if (!error) return 500;
  if (/não configurado|GEMINI_API_KEY/i.test(error)) return 503;
  if (/cobrança|billing|403|Forbidden|quota|Limite de uso|indisponível|demorou mais/i.test(error)) return 502;
  if (/timeout|demorou/i.test(error)) return 504;
  return 500;
}

async function resolveNomeOperador(req: Request): Promise<string> {
  const fromBody = String(req.body?.nomeOperador ?? '').trim();
  if (fromBody) return fromBody;

  const fromAuth = String(req.user?.name ?? '').trim();
  if (fromAuth) return fromAuth;

  return resolveOperadorDisplayNameForAuthEmail(req.user?.email || '');
}

router.post('/refinar-rascunho', authMiddleware, async (req: Request, res: Response) => {
  const parsed = validateRascunhoInput(req.body?.rascunho);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: parsed.error });
  }

  if (!isGeminiRefinarConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Serviço Gemini não configurado. Defina GEMINI_API_KEY no backend.',
    });
  }

  const nomeOperador = await resolveNomeOperador(req);
  const userId = req.user?.email || req.user?.userId || 'anonymous';

  const aiResult = await generateRefinarRascunhoWithGemini({
    rascunho: parsed.text,
    nomeOperador,
    userId: String(userId),
  });

  if (!aiResult.success) {
    return res.status(statusForGeminiError(aiResult.error)).json({
      success: false,
      error: aiResult.error || 'Não foi possível refinar o rascunho',
    });
  }

  return res.json({
    success: true,
    response: aiResult.response,
    aiProvider: 'Gemini',
    model: aiResult.model,
    source: 'refinar_rascunho',
  });
});

export default router;
