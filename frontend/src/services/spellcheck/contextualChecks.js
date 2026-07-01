/**
 * contextualChecks v1.0.0 — erros contextuais de alta confiança (modal + infinitivo)
 * VERSION: v1.0.0 | DATE: 2026-06-26
 */

/** @type {Set<string>} */
const MODAL_VERBS = new Set([
  'posso', 'pode', 'podemos', 'podem',
  'preciso', 'precisa', 'precisamos', 'precisam',
  'devo', 'deve', 'devemos', 'devem',
  'vou', 'vai', 'vamos', 'vão', 'vao',
  'quero', 'quer', 'queremos', 'querem',
]);

/** @type {Set<string>} */
const CLITIC_PRONOUNS = new Set(['te', 'me', 'lhe', 'nos', 'vos']);

/** @type {RegExp} */
const INFINITIVE_SUFFIX = /(?:ar|er|ir|or)$/i;

/**
 * Após modal (+ pronome opcional), exige infinitivo: "posso te ajuda" → "ajudar".
 * @param {Array<{ word: string }>} tokens
 * @param {number} index
 * @param {(word: string) => boolean} isInfinitiveCandidate
 */
export function getModalInfinitiveFix(tokens, index, isInfinitiveCandidate) {
  if (index < 1 || !tokens[index]?.word) return null;

  let prevIndex = index - 1;
  let prev = tokens[prevIndex]?.word?.toLowerCase();

  if (CLITIC_PRONOUNS.has(prev) && prevIndex >= 1) {
    prevIndex -= 1;
    prev = tokens[prevIndex]?.word?.toLowerCase();
  }

  if (!MODAL_VERBS.has(prev)) return null;

  const word = tokens[index].word;
  const lower = word.toLowerCase();

  if (INFINITIVE_SUFFIX.test(lower)) return null;

  if (lower.endsWith('a') && !lower.endsWith('ar')) {
    const candidate = `${lower.slice(0, -1)}ar`;
    if (candidate !== lower && isInfinitiveCandidate(candidate)) {
      return { suggestions: [candidate] };
    }
  }

  return null;
}
