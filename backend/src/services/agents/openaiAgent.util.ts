/**
 * openaiAgent.util v1.0.0 — cliente OpenAI e helpers compartilhados dos agentes
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import OpenAI from 'openai';
import { env } from '../../config/env';

const REQUEST_TIMEOUT_MS = 120_000;

let clientInstance: OpenAI | null = null;

export function createOpenAiClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      apiKey: env.openaiApiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 2,
      fetch: globalThis.fetch,
    });
  }
  return clientInstance;
}

export function trimStr(value: unknown, maxLen: number): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function resolveClientFirstName(fullName: string): string {
  const name = trimStr(fullName, 200);
  if (!name) return '';
  return name.split(/\s+/)[0] || name;
}

export function mapOpenAiErrorMessage(err: unknown): string {
  const message = (err as Error)?.message || String(err);
  if (/401|invalid_api_key|Incorrect API key/i.test(message)) {
    return 'Chave OpenAI inválida. Verifique OPENAI_API_KEY.';
  }
  if (/429|rate limit|quota/i.test(message)) {
    return 'Limite de uso da API OpenAI atingido. Tente novamente em alguns minutos.';
  }
  if (/402|billing|insufficient/i.test(message)) {
    return 'Conta OpenAI sem crédito ou cobrança pendente.';
  }
  if (/404|not found|vector_store/i.test(message)) {
    return 'Vector store ou modelo indisponível. Verifique IDs das vector stores e OPENAI_MODEL.';
  }
  if (/timeout|ETIMEDOUT|abort|Premature close|ERR_STREAM_PREMATURE_CLOSE/i.test(message)) {
    return 'Tempo esgotado ou conexão interrompida ao consultar a IA. Tente novamente.';
  }
  return message || 'Não foi possível processar solicitação da IA';
}

export function extractOutputText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  for (const item of response.output || []) {
    if (item.type === 'message' && 'content' in item) {
      for (const part of item.content || []) {
        if (part.type === 'output_text' && part.text?.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return '';
}

export function parseAiJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export function getAtendimentoVectorStoreIds(): string[] {
  const ids = [
    env.openaiPublicVectorStoreId,
    env.openaiPopVectorStoreId,
  ].filter(Boolean);
  return [...new Set(ids)];
}

export function getAuditoriaVectorStoreIds(): string[] {
  const ids = [
    env.openaiPopVectorStoreId,
    env.openaiAuditVectorStoreId,
  ].filter(Boolean);
  if (ids.length === 0 && env.openaiPopVectorStoreId) {
    return [env.openaiPopVectorStoreId];
  }
  return [...new Set(ids)];
}

export function getAgentsStatus(): {
  configured: boolean;
  missing: string[];
  agentsEnabled: boolean;
  autonomyEnabled: boolean;
} {
  const missing: string[] = [];
  if (!env.openaiApiKey?.trim()) missing.push('OPENAI_API_KEY');
  if (!env.openaiPopVectorStoreId?.trim()) missing.push('OPENAI_POP_VECTOR_STORE_ID');
  if (!env.openaiPublicVectorStoreId?.trim()) missing.push('OPENAI_PUBLIC_VECTOR_STORE_ID');
  return {
    configured: missing.length === 0,
    missing,
    agentsEnabled: env.agentsEnabled,
    autonomyEnabled: env.agentsAutonomyEnabled,
  };
}

export function isAgentsConfigured(): boolean {
  return getAgentsStatus().configured;
}
