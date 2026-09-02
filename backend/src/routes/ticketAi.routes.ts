/**
 * ticketAi.routes v1.1.0 — /suggest-stream: SSE com progresso por etapa (gerando/auditando/
 * revisando), pra frontend não ficar com barra travada sem feedback durante o pipeline
 * VERSION: v1.1.0 | DATE: 2026-09-02
 */
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { resolveOperadorDisplayNameForAuthEmail } from '../services/colaboradoresCadastro.service';
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
    agentsEnabled: env.agentsEnabled,
    source: 'ticket_ai_status',
  });
});

router.post('/suggest', authMiddleware, async (req: Request, res: Response) => {
  try {
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
    const nomeOperador = await resolveOperadorDisplayNameForAuthEmail(req.user?.email || '');
    const aiResult = await generateTicketAiSuggest(
      { ...parsed.data, nomeOperador: nomeOperador || undefined },
      String(userId),
    );

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
      tabulacaoFonte: aiResult.tabulacaoFonte || 'atendimento',
      auditScore: aiResult.auditScore,
      auditAprovado: aiResult.auditAprovado,
      auditDecisao: aiResult.auditDecisao,
      auditComplete: aiResult.auditComplete ?? false,
      confidence: aiResult.confidence,
      revisoesRealizadas: aiResult.revisoesRealizadas,
      aiProvider: 'OpenAI',
      model: aiResult.model,
      source: 'ticket_ai_suggest',
    });
  } catch (err) {
    console.error('[ticket-ai-suggest] erro não tratado:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao gerar sugestão da IA.',
    });
  }
});

router.post('/suggest-stream', authMiddleware, async (req: Request, res: Response) => {
  const parsed = validateTicketAiInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: parsed.error });
  }

  const configStatus = getOpenAiTicketSuggestStatus();
  if (!configStatus.configured) {
    return res.status(503).json({
      success: false,
      error: 'Serviço OpenAI não configurado no servidor.',
      missing: configStatus.missing,
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  try {
    const userId = req.user?.email || req.user?.userId || 'anonymous';
    const nomeOperador = await resolveOperadorDisplayNameForAuthEmail(req.user?.email || '');
    const aiResult = await generateTicketAiSuggest(
      {
        ...parsed.data,
        nomeOperador: nomeOperador || undefined,
        onStage: (stage) => send({ stage }),
      },
      String(userId),
    );

    if (!aiResult.success) {
      send({ done: true, success: false, error: aiResult.error || 'Não foi possível gerar sugestão' });
    } else {
      send({
        done: true,
        success: true,
        respostaSugerida: aiResult.respostaSugerida,
        tabulacao: aiResult.tabulacao,
        tabulacaoDisplay: aiResult.tabulacaoDisplay,
        tabulacaoFonte: aiResult.tabulacaoFonte || 'atendimento',
        auditScore: aiResult.auditScore,
        auditAprovado: aiResult.auditAprovado,
        auditDecisao: aiResult.auditDecisao,
        auditComplete: aiResult.auditComplete ?? false,
        confidence: aiResult.confidence,
        revisoesRealizadas: aiResult.revisoesRealizadas,
        aiProvider: 'OpenAI',
        model: aiResult.model,
      });
    }
  } catch (err) {
    console.error('[ticket-ai-suggest-stream] erro não tratado:', err);
    send({ done: true, success: false, error: 'Falha ao gerar sugestão da IA.' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
