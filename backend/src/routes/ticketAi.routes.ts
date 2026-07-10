/** ticketAi.routes v1.0.1 — status de configuração + sugestão IA */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import {
  generateTicketAiSuggest,
  getOpenAiTicketSuggestStatus,
  statusForOpenAiError,
  validateTicketAiInput,
} from '../services/openaiTicketSuggest.service';

const router = Router();

router.get('/status', authMiddleware, (_req: Request, res: Response) => {
  const status = getOpenAiTicketSuggestStatus();
  return res.json({
    success: true,
    configured: status.configured,
    missing: status.missing,
    model: env.openaiModel,
    source: 'ticket_ai_status',
  });
});

router.post('/suggest', authMiddleware, async (req: Request, res: Response) => {
  const parsed = validateTicketAiInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: parsed.error });
  }

  const configStatus = getOpenAiTicketSuggestStatus();
  if (!configStatus.configured) {
    console.warn('[ticket-ai-suggest] 503 — variáveis ausentes no servidor:', configStatus.missing.join(', '));
    return res.status(503).json({
      success: false,
      error: 'Serviço OpenAI não configurado no servidor.',
      missing: configStatus.missing,
      hint: 'Defina OPENAI_API_KEY e OPENAI_VECTOR_STORE_ID (ou VECTOR_STORE_PATH) no Cloud Run / backend.',
    });
  }

  const userId = req.user?.email || req.user?.userId || 'anonymous';
  const aiResult = await generateTicketAiSuggest(parsed.data, String(userId));

  if (!aiResult.success) {
    return res.status(statusForOpenAiError(aiResult.error)).json({
      success: false,
      error: aiResult.error || 'Não foi possível gerar sugestão',
    });
  }

  return res.json({
    success: true,
    respostaSugerida: aiResult.respostaSugerida,
    tabulacao: aiResult.tabulacao,
    tabulacaoDisplay: aiResult.tabulacaoDisplay,
    aiProvider: 'OpenAI',
    model: aiResult.model,
    source: 'ticket_ai_suggest',
  });
});

export default router;
