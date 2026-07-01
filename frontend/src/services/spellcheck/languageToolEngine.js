/**
 * languageToolEngine v1.0.0 — corretor via LanguageTool self-hosted (API backend)
 * VERSION: v1.0.0 | DATE: 2026-06-26
 */
import api from '../../api/client.js';
import { buildWhitelistFromConfig } from './whitelist.js';

/** @type {boolean} */
let engineReady = false;
/** @type {Promise<boolean>|null} */
let loadPromise = null;

export async function loadSpellEngine() {
  if (engineReady) return true;
  if (!loadPromise) {
    loadPromise = api.get('/spellcheck/status')
      .then((response) => {
        engineReady = Boolean(response.data?.available);
        return engineReady;
      })
      .catch(() => {
        engineReady = false;
        return false;
      });
  }
  return loadPromise;
}

export function isSpellEngineReady() {
  return engineReady;
}

/** @param {object|null|undefined} config @param {Iterable<string>} [ignoredWords] */
export function createSpellContext(config, ignoredWords) {
  return {
    whitelist: buildWhitelistFromConfig(config),
    ignoredWords: new Set(ignoredWords || []),
  };
}

/**
 * @param {string} text
 * @param {Set<string>} whitelist
 * @param {Set<string>} ignoredWords
 * @param {AbortSignal} [signal]
 */
async function requestCheck(text, whitelist, ignoredWords, signal) {
  const response = await api.post('/spellcheck/check', {
    text,
    whitelist: [...whitelist],
    ignoredWords: [...ignoredWords],
  }, { signal });

  const data = response.data || {};
  if (data.available === false) {
    engineReady = false;
  } else if (data.available === true) {
    engineReady = true;
  }
  return data.errors || [];
}

function isAbortError(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError';
}

/**
 * @param {string} text
 * @param {Set<string>} whitelist
 * @param {Set<string>} [ignoredWords]
 * @param {AbortSignal} [signal]
 */
export async function scanText(text, whitelist, ignoredWords, signal) {
  if (!String(text || '').trim()) return [];
  try {
    return await requestCheck(text, whitelist, ignoredWords, signal);
  } catch (err) {
    if (isAbortError(err)) throw err;
    return [];
  }
}

/**
 * @param {string} word
 * @param {Set<string>} whitelist
 * @param {Set<string>} [ignoredWords]
 * @param {{ text?: string, startIndex?: number, tokens?: object[], tokenIndex?: number }} [context]
 * @param {AbortSignal} [signal]
 */
export async function checkWord(word, whitelist, ignoredWords, context, signal) {
  const fullText = context?.text;
  if (!fullText?.trim()) {
    return { valid: true, suggestions: [] };
  }

  try {
    const errors = await requestCheck(fullText, whitelist, ignoredWords, signal);
    const focusStart = context?.startIndex ?? (
      context?.tokenIndex != null
        ? context.tokens?.[context.tokenIndex]?.startIndex
        : undefined
    );

    if (focusStart == null) {
      const match = errors.find((error) => error.word === word);
      return match
        ? { valid: false, suggestions: match.suggestions }
        : { valid: true, suggestions: [] };
    }

    const focused = errors.find((error) => error.startIndex === focusStart);
    if (!focused) return { valid: true, suggestions: [] };
    return { valid: false, suggestions: focused.suggestions };
  } catch (err) {
    if (isAbortError(err)) throw err;
    return { valid: true, suggestions: [] };
  }
}
