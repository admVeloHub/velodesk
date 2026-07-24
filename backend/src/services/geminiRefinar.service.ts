/**
 * geminiRefinar.service v1.0.2 — modelos atuais (2.5) + fallback em cadeia
 * VERSION: v1.0.2 | DATE: 2026-07-02
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { getRefinarRascunhoPersona } from './refinarRascunhoPersona';
import { logAiUsage } from './aiUsage.service';

const MAX_RASCUNHO_CHARS = 25_000;
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'] as const;

function buildModelsToTry(primary: string): string[] {
  const ordered = [primary, ...GEMINI_FALLBACK_MODELS];
  return [...new Set(ordered.map((m) => m.trim()).filter(Boolean))];
}

export function validateRascunhoInput(rascunho: unknown): { ok: true; text: string } | { ok: false; error: string } {
  if (rascunho == null || typeof rascunho !== 'string' || !String(rascunho).trim()) {
    return { ok: false, error: 'Rascunho é obrigatório' };
  }
  const text = String(rascunho).trim();
  if (text.length > MAX_RASCUNHO_CHARS) {
    return { ok: false, error: 'Rascunho excede o limite de 25.000 caracteres' };
  }
  return { ok: true, text };
}

export function isGeminiRefinarConfigured(): boolean {
  return Boolean(env.geminiApiKey?.trim());
}

function mapGeminiErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err);
  if (/403|Forbidden/i.test(message) && /dunning|billing|quota|permission/i.test(message)) {
    return 'Conta Google Gemini com cobrança suspensa ou sem permissão. Verifique faturamento no Google Cloud / AI Studio ou use outra GEMINI_API_KEY.';
  }
  if (/429|quota|rate limit/i.test(message)) {
    return 'Limite de uso da API Gemini atingido. Tente novamente em alguns minutos.';
  }
  if (/404|not found|no longer available/i.test(message)) {
    return `Modelo Gemini indisponível (${env.geminiModel}). Ajuste GEMINI_MODEL no backend (ex.: gemini-2.5-flash).`;
  }
  return message || 'Não foi possível refinar o rascunho';
}

async function callGeminiModel(modelName: string, fullPrompt: string, userId?: string) {
  const gemini = new GoogleGenerativeAI(env.geminiApiKey);
  const model = gemini.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(fullPrompt);

  const usage = result.response.usageMetadata;
  if (usage) {
    void logAiUsage({
      provider: 'gemini',
      model: modelName,
      feature: 'refinar_rascunho',
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      userId,
    });
  }

  return result.response.text();
}

export async function generateRefinarRascunhoWithGemini(params: {
  rascunho: string;
  nomeOperador?: string;
  userId?: string;
}): Promise<{ success: boolean; response?: string; model?: string; error?: string }> {
  if (!isGeminiRefinarConfigured()) {
    return { success: false, error: 'Serviço Gemini não configurado' };
  }

  try {
    const systemPrompt = getRefinarRascunhoPersona();
    const nome = String(params.nomeOperador || '').trim() || 'não informado';

    const userBlock =
      '## Dados desta solicitação\n\n'
      + '- **Nome do operador** (usar no lugar de [Nome do Operador] no template; se for "não informado", use cumprimento profissional sem inventar nome): '
      + `${nome}\n\n`
      + '- **Rascunho do colaborador** (única fonte do desenvolvimento; não invente prazos, valores nem procedimentos):\n\n'
      + `${params.rascunho}\n\n`
      + '## Tarefa\n\n'
      + 'Aplique a persona (travas, estrutura do e-mail). **Saída:** somente o corpo do e-mail refinado em português brasileiro, texto simples, sem rascunho repetido, sem análise, sem seções, sem preâmbulo.\n';

    const fullPrompt = `${systemPrompt}\n\n${userBlock}`;
    console.log('[gemini-refinar] processando para', params.userId || 'anonimo');

    const modelsToTry = buildModelsToTry(env.geminiModel);

    let lastError: unknown = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await callGeminiModel(modelName, fullPrompt, params.userId);
        if (modelName !== env.geminiModel) {
          console.warn(`[gemini-refinar] fallback OK com modelo ${modelName}`);
        }
        return {
          success: true,
          response,
          model: modelName,
        };
      } catch (err) {
        lastError = err;
        console.error(`[gemini-refinar] modelo ${modelName}:`, (err as Error).message);
      }
    }

    return {
      success: false,
      error: mapGeminiErrorMessage(lastError),
    };
  } catch (err) {
    console.error('[gemini-refinar]', (err as Error).message);
    return {
      success: false,
      error: mapGeminiErrorMessage(err),
    };
  }
}
