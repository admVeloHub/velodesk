/** ticketAi.routes v1.0.0 — sugestão IA resposta + tabulação na abertura do ticket */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  generateTicketAiSuggest,
  isOpenAiTicketSuggestConfigured,
  statusForOpenAiError,
  validateTicketAiInput,
} from '../services/openaiTicketSuggest.service';

const router = Router();

router.post('/suggest', authMiddleware, async (req: Request, res: Response) => {
  const parsed = validateTicketAiInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: parsed.error });
  }

  if (!isOpenAiTicketSuggestConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Serviço OpenAI não configurado. Defina OPENAI_API_KEY e OPENAI_VECTOR_STORE_ID (ou VECTOR_STORE_PATH) no backend.',
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
