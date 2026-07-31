/**
 * geminiRefinar.service v1.1.0 — flash-lite prioritário, timeout e fallback rápido
 * VERSION: v1.1.0 | DATE: 2026-07-30
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { getRefinarRascunhoPersona } from './refinarRascunhoPersona';
import { logAiUsage } from './aiUsage.service';

const MAX_RASCUNHO_CHARS = 25_000;
/** Modelos rápidos — sem Pro (latência imprevisível em revisão curta). */
const REFINAR_FAST_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const;
const REFINAR_TIMEOUT_MS = 18_000;
const REFINAR_MAX_OUTPUT_TOKENS = 4096;

let geminiClient: GoogleGenerativeAI | null = null;
let cachedSystemPrompt: string | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return geminiClient;
}

function getSystemPrompt(): string {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = getRefinarRascunhoPersona();
  }
  return cachedSystemPrompt;
}

function buildRefinarModelsToTry(): string[] {
  const primary = (env.geminiRefinarModel || env.geminiModel || REFINAR_FAST_MODELS[0]).trim();
  const ordered = [primary, ...REFINAR_FAST_MODELS];
  return [...new Set(ordered.filter(Boolean))];
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timeout após ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isRetryableGeminiError(err: unknown): boolean {
  const message = (err as Error)?.message || String(err);
  return /404|not found|no longer available|429|quota|rate limit|503|unavailable|overloaded|500|internal|timeout após/i.test(message);
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
  if (/timeout após/i.test(message)) {
    return 'A revisão demorou mais que o esperado. Tente novamente em instantes.';
  }
  if (/403|Forbidden/i.test(message) && /dunning|billing|quota|permission/i.test(message)) {
    return 'Conta Google Gemini com cobrança suspensa ou sem permissão. Verifique faturamento no Google Cloud / AI Studio ou use outra GEMINI_API_KEY.';
  }
  if (/429|quota|rate limit/i.test(message)) {
    return 'Limite de uso da API Gemini atingido. Tente novamente em alguns minutos.';
  }
  if (/404|not found|no longer available/i.test(message)) {
    return `Modelo Gemini indisponível (${env.geminiRefinarModel || env.geminiModel}). Ajuste GEMINI_REFINAR_MODEL no backend (ex.: gemini-2.5-flash-lite).`;
  }
  return message || 'Não foi possível refinar o rascunho';
}

function buildUserBlock(rascunho: string, nomeOperador: string): string {
  const nome = String(nomeOperador || '').trim() || 'não informado';
  return (
    '## Dados desta solicitação\n\n'
    + '- **Nome do operador** (usar no lugar de [Nome do Operador] no template; se for "não informado", use cumprimento profissional sem inventar nome): '
    + `${nome}\n\n`
    + '- **Rascunho do colaborador** (única fonte do desenvolvimento; não invente prazos, valores nem procedimentos):\n\n'
    + `${rascunho}\n\n`
    + '## Tarefa\n\n'
    + 'Aplique a persona (travas, estrutura do e-mail). **Saída:** somente o corpo do e-mail refinado em português brasileiro, texto simples, sem rascunho repetido, sem análise, sem seções, sem preâmbulo.\n'
  );
}

async function callGeminiModel(
  modelName: string,
  userBlock: string,
  userId?: string,
): Promise<string> {
  const model = getGeminiClient().getGenerativeModel({
    model: modelName,
    systemInstruction: getSystemPrompt(),
    generationConfig: {
      maxOutputTokens: REFINAR_MAX_OUTPUT_TOKENS,
      temperature: 0.35,
    },
  });

  const result = await withTimeout(
    model.generateContent(userBlock),
    REFINAR_TIMEOUT_MS,
    `Gemini ${modelName}`,
  );

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

  const startedAt = Date.now();
  const userBlock = buildUserBlock(params.rascunho, String(params.nomeOperador || ''));
  const modelsToTry = buildRefinarModelsToTry();

  console.info('[gemini-refinar] início', {
    userId: params.userId || 'anonimo',
    chars: params.rascunho.length,
    models: modelsToTry,
  });

  let lastError: unknown = null;
  for (const modelName of modelsToTry) {
    const modelStarted = Date.now();
    try {
      const response = await callGeminiModel(modelName, userBlock, params.userId);
      console.info('[gemini-refinar] ok', {
        model: modelName,
        ms: Date.now() - startedAt,
        modelMs: Date.now() - modelStarted,
        chars: params.rascunho.length,
      });
      if (modelName !== modelsToTry[0]) {
        console.warn(`[gemini-refinar] fallback OK com modelo ${modelName}`);
      }
      return {
        success: true,
        response,
        model: modelName,
      };
    } catch (err) {
      lastError = err;
      console.warn('[gemini-refinar] falha', {
        model: modelName,
        modelMs: Date.now() - modelStarted,
        error: (err as Error).message,
      });
      if (!isRetryableGeminiError(err)) break;
    }
  }

  console.error('[gemini-refinar] esgotado', {
    ms: Date.now() - startedAt,
    error: (lastError as Error)?.message,
  });

  return {
    success: false,
    error: mapGeminiErrorMessage(lastError),
  };
}
