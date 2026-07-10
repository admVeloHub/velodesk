/**
 * spellcheckSuggestionRank v1.1.0 — filtra sugestões ruins do LT e injeta typos PT-BR
 * VERSION: v1.1.0 | DATE: 2026-07-10
 */
import {
  KNOWN_TYPO_MAP,
  PT_LEXICON,
  isKnownTypoTarget,
  lookupKnownTypo,
  normalizeToken,
} from './spellcheckPtLexicon';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = temp;
    }
  }
  return dp[n];
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.,;:!?…]+$/g, '').trim();
}

/** Rejeita sugestões que só acrescentam pontuação (ex.: pa → pa.). */
export function isPunctuationOnlyChange(input: string, candidate: string): boolean {
  const a = stripTrailingPunctuation(input).toLowerCase();
  const b = stripTrailingPunctuation(candidate).toLowerCase();
  return a === b && input.trim() !== candidate.trim();
}

function isPlausibleShape(input: string, candidate: string): boolean {
  const a = normalizeToken(input);
  const b = normalizeToken(candidate);
  if (!candidate || a === b) return false;
  if (!input.includes('-') && candidate.includes('-')) return false;
  if (!/\s/.test(input) && /\s/.test(candidate.trim())) return false;
  if (levenshtein(a, b.replace(/-/g, '')) > 3) return false;
  return true;
}

/** Sugestão precisa ser palavra PT conhecida ou correção mapeada. */
export function isAcceptableSuggestion(input: string, candidate: string): boolean {
  if (!isPlausibleShape(input, candidate)) return false;
  if (isPunctuationOnlyChange(input, candidate)) return false;

  const target = normalizeToken(candidate);
  if (isKnownTypoTarget(target)) return true;
  if (Object.values(KNOWN_TYPO_MAP).some((word) => normalizeToken(word) === target)) return true;

  const inputNorm = normalizeToken(input);
  let bestLexiconDistance = Infinity;
  for (const lexWord of PT_LEXICON) {
    if (lexWord.length < 3) continue;
    const dist = levenshtein(inputNorm, lexWord);
    if (dist < bestLexiconDistance) bestLexiconDistance = dist;
    if (dist <= 1 && lexWord === target) return true;
  }

  const targetDist = levenshtein(inputNorm, target);
  if (targetDist <= 2 && isKnownTypoTarget(target)) return true;

  // Rejeita sugestões que não aproximam de nenhuma palavra do léxico (ex.: ezato → ecato)
  if (!isKnownTypoTarget(target) && bestLexiconDistance <= 2) {
    const targetToLexicon = levenshtein(target, [...PT_LEXICON].find((w) => (
      levenshtein(inputNorm, w) === bestLexiconDistance
    )) || target);
    if (targetToLexicon > 1) return false;
  }

  return isKnownTypoTarget(target);
}

function scoreSuggestion(input: string, candidate: string): number {
  const a = normalizeToken(input);
  const b = normalizeToken(candidate);
  let score = levenshtein(a, b) * 10;
  if (KNOWN_TYPO_MAP[a] === b) score -= 50;
  if (PT_LEXICON.has(b)) score -= 20;
  if (candidate.includes('-') && !input.includes('-')) score += 25;
  if (/\s/.test(candidate) && !/\s/.test(input)) score += 20;
  score += Math.abs(a.length - b.length) * 2;
  return score;
}

/** Busca correção por mapa fixo ou proximidade no léxico (ex.: valo → valor). */
export function findLexiconFuzzyCorrection(word: string): string | null {
  const key = normalizeToken(word);
  if (!key || key.length < 2) return null;
  if (PT_LEXICON.has(key)) return null;

  const mapped = lookupKnownTypo(key);
  if (mapped) return mapped;

  if (key.length < 3) return null;

  let best: { word: string; dist: number } | null = null;
  for (const lexWord of PT_LEXICON) {
    if (lexWord.length < 3) continue;
    if (Math.abs(lexWord.length - key.length) > 2) continue;
    const dist = levenshtein(key, lexWord);
    if (dist < 1 || dist > 2) continue;
    if (!best || dist < best.dist) {
      best = { word: lexWord, dist };
    }
  }
  return best?.word ?? null;
}

/** Reordena e saneia sugestões do LanguageTool. */
export function rankSpellSuggestions(input: string, suggestions: string[]): string[] {
  const injected: string[] = [];
  const mapped = lookupKnownTypo(input);
  if (mapped) injected.push(mapped);
  const fuzzy = findLexiconFuzzyCorrection(input);
  if (fuzzy && !injected.includes(fuzzy)) injected.push(fuzzy);

  const seen = new Set<string>();
  return [...injected, ...suggestions]
    .filter((item) => isAcceptableSuggestion(input, item))
    .sort((left, right) => {
      const diff = scoreSuggestion(input, left) - scoreSuggestion(input, right);
      if (diff !== 0) return diff;
      return left.localeCompare(right, 'pt-BR');
    })
    .filter((item) => {
      const key = normalizeToken(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}
