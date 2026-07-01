/**
 * languagetool.service v1.0.2 — ranking de sugestões (criente → cliente, não criem-te)
 * VERSION: v1.0.2 | DATE: 2026-07-01
 */
import { env } from '../config/env';
import { rankSpellSuggestions } from './spellcheckSuggestionRank';

/** Categorias que bloqueiam envio (STYLE fica de fora). */
const BLOCKING_CATEGORIES = new Set([
  'TYPOS',
  'GRAMMAR',
  'CONFUSED_WORDS',
  'PUNCTUATION',
]);

const DISABLED_LT_CATEGORIES = [
  'STYLE',
  'REDUNDANCY',
  'TYPOGRAPHY',
  'PLAIN_ENGLISH',
  'COLLOQUIALISMS',
  'CASING',
].join(',');

const LT_LOG_COOLDOWN_MS = 60_000;
let lastFailureLogAt = 0;

function formatFetchError(err: unknown): string {
  const error = err as Error & { cause?: { code?: string; message?: string } };
  const code = error.cause?.code || (error as NodeJS.ErrnoException).code;
  if (code === 'ECONNREFUSED') {
    return `conexão recusada (${env.languageToolUrl}) — serviço não está rodando`;
  }
  if (error.name === 'AbortError') {
    return `timeout após ${env.languageToolTimeoutMs}ms (${env.languageToolUrl})`;
  }
  return error.message || 'fetch failed';
}

function logLanguageToolFailureOnce(err: unknown): void {
  const now = Date.now();
  if (now - lastFailureLogAt < LT_LOG_COOLDOWN_MS) return;
  lastFailureLogAt = now;
  console.warn(
    `[languagetool] ${formatFetchError(err)} — compose em modo degradado (envio liberado).\n`
    + '  Suba o LanguageTool: Docker Desktop → docker run --rm -p 8010:8010 erikvl87/languagetool',
  );
}

export async function logLanguageToolStartupStatus(): Promise<void> {
  if (!isLanguageToolConfigured()) {
    console.log('[languagetool] desabilitado (LANGUAGETOOL_ENABLED=false)');
    return;
  }
  const available = await checkLanguageToolHealth();
  if (available) {
    console.log(`[languagetool] conectado em ${env.languageToolUrl}`);
    return;
  }
  console.warn(
    `[languagetool] indisponível em ${env.languageToolUrl} — corretor em modo degradado.\n`
    + '  1) Abra o Docker Desktop\n'
    + '  2) docker run --rm -p 8010:8010 erikvl87/languagetool',
  );
}

export interface SpellcheckErrorDto {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions: string[];
  message?: string;
  category?: string;
  ruleId?: string;
}

interface LtMatch {
  offset: number;
  length: number;
  message?: string;
  replacements?: Array<{ value: string }>;
  rule?: {
    id?: string;
    category?: { id?: string; name?: string };
  };
}

interface LtCheckResponse {
  matches?: LtMatch[];
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function shouldSkipToken(token: string, whitelist: Set<string>, ignoredWords: Set<string>): boolean {
  if (!token || token.length < 2) return true;
  const lower = token.toLowerCase();
  if (ignoredWords.has(lower)) return true;
  if (whitelist.has(lower)) return true;
  if (/^\d+$/.test(token)) return true;
  if (/^[A-Z]{2,}\d*$/.test(token)) return true;
  if (token.includes('@')) return true;
  return false;
}

function isBlockingCategory(categoryId?: string): boolean {
  if (!categoryId) return true;
  return BLOCKING_CATEGORIES.has(categoryId.toUpperCase());
}

function mapMatchToError(text: string, match: LtMatch): SpellcheckErrorDto | null {
  const categoryId = match.rule?.category?.id || '';
  if (!isBlockingCategory(categoryId)) return null;

  const startIndex = match.offset;
  const endIndex = match.offset + match.length;
  if (startIndex < 0 || endIndex > text.length) return null;

  const word = text.slice(startIndex, endIndex);
  if (!word.trim()) return null;

  const suggestions = rankSpellSuggestions(
    word,
    (match.replacements || []).map((item) => item.value).filter(Boolean),
  );

  if (!suggestions.length) return null;

  return {
    word,
    startIndex,
    endIndex,
    suggestions,
    message: match.message,
    category: categoryId,
    ruleId: match.rule?.id,
  };
}

export function isLanguageToolConfigured(): boolean {
  return env.languageToolEnabled && Boolean(env.languageToolUrl?.trim());
}

export async function checkLanguageToolHealth(): Promise<boolean> {
  if (!isLanguageToolConfigured()) return false;
  const baseUrl = normalizeBaseUrl(env.languageToolUrl);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.languageToolTimeoutMs);
    const res = await fetch(`${baseUrl}/v2/languages`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param text Texto completo (LanguageTool exige contexto para gramática).
 * @param whitelist Termos da empresa / tabulação.
 * @param ignoredWords Palavras ignoradas na sessão.
 */
export async function checkTextWithLanguageTool(
  text: string,
  whitelist: Iterable<string> = [],
  ignoredWords: Iterable<string> = [],
): Promise<{ available: boolean; errors: SpellcheckErrorDto[] }> {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { available: true, errors: [] };

  if (!isLanguageToolConfigured()) {
    return { available: false, errors: [] };
  }

  const whitelistSet = new Set([...whitelist].map((w) => w.toLowerCase()));
  const ignoredSet = new Set([...ignoredWords].map((w) => w.toLowerCase()));
  const baseUrl = normalizeBaseUrl(env.languageToolUrl);

  const body = new URLSearchParams();
  body.set('language', env.languageToolLanguage);
  body.set('text', text);
  body.set('disabledCategories', DISABLED_LT_CATEGORIES);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.languageToolTimeoutMs);
    const res = await fetch(`${baseUrl}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logLanguageToolFailureOnce(new Error(`HTTP ${res.status}`));
      return { available: false, errors: [] };
    }

    const data = (await res.json()) as LtCheckResponse;
    const errors: SpellcheckErrorDto[] = [];

    for (const match of data.matches || []) {
      const mapped = mapMatchToError(text, match);
      if (!mapped) continue;
      if (shouldSkipToken(mapped.word, whitelistSet, ignoredSet)) continue;
      errors.push(mapped);
    }

    errors.sort((a, b) => a.startIndex - b.startIndex);
    return { available: true, errors };
  } catch (err) {
    logLanguageToolFailureOnce(err);
    return { available: false, errors: [] };
  }
}
