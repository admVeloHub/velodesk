/**
 * fastSpellEngine v1.1.0 — corretor PT-BR rápido (aff/dic Hunspell sem nspell)
 * VERSION: v1.1.0 | DATE: 2026-06-26
 */
import {
  buildAccentGroups,
  forwardAffixStem,
  parseAff,
  parseDicStems,
  reverseAffixStem,
  stemMatches,
  stripAccents,
} from './parseHunspell';
import { isCommonWordPt } from './commonWordsPt';
import { keyboardAwareWordDistance } from './keyboardDistance';
import { buildWhitelistFromConfig, shouldSkipWord } from './whitelist';
import { tokenizeText } from './tokenize';

/** @type {null | {
 *   stems: Map<string, Set<string>>,
 *   sfxByFlag: Map<string, import('./parseHunspell.js').AffixRule[]>,
 *   accentGroups: Map<string, Set<string>>,
 *   stemList: string[],
 *   stemsByLength: Map<number, string[]>,
 * }} */
let engine = null;
/** @type {Promise<typeof engine>|null} */
let loadPromise = null;

/**
 * @param {import('./parseHunspell.js').AffixRule[]} rules
 */
function indexRulesByFlag(rules) {
  const map = new Map();
  for (const rule of rules) {
    if (!map.has(rule.flag)) map.set(rule.flag, []);
    map.get(rule.flag).push(rule);
  }
  return map;
}

export async function loadSpellEngine() {
  if (engine) return engine;
  if (!loadPromise) {
    loadPromise = (async () => {
      const [affModule, dicModule] = await Promise.all([
        import('dictionary-pt-br/index.aff?raw'),
        import('dictionary-pt-br/index.dic?raw'),
      ]);
      const affText = affModule.default;
      const dicText = dicModule.default;
      const { accentMaps, sfxRules } = parseAff(affText);
      const stems = parseDicStems(dicText);
      const accentGroups = buildAccentGroups(dicText, accentMaps);
      const sfxByFlag = indexRulesByFlag(sfxRules);
      const stemList = [...stems.keys()];
      const stemsByLength = new Map();
      for (const stem of stemList) {
        const len = stem.length;
        if (!stemsByLength.has(len)) stemsByLength.set(len, []);
        stemsByLength.get(len).push(stem);
      }
      engine = { stems, sfxByFlag, accentGroups, stemList, stemsByLength };
      return engine;
    })();
  }
  return loadPromise;
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function isWordFormValid(dict, word) {
  const lower = word.toLowerCase();
  if (isCommonWordPt(lower)) return true;

  const flags = dict.stems.get(lower);
  if (flags) return true;

  for (const [flag, rules] of dict.sfxByFlag) {
    for (const rule of rules) {
      const candidate = reverseAffixStem(lower, rule.strip, rule.add);
      if (!candidate) continue;
      if (rule.match && !stemMatches(candidate, rule.match)) continue;
      const stemFlags = dict.stems.get(candidate);
      if (stemFlags?.has(flag)) return true;
    }
  }

  const norm = stripAccents(word);
  const group = dict.accentGroups.get(norm);
  if (group) {
    for (const form of group) {
      if (form === word || form.toLowerCase() === lower) return true;
    }
  }

  return false;
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function suggestAccent(dict, word) {
  const norm = stripAccents(word);
  const group = dict.accentGroups.get(norm);
  if (!group) return [];
  return [...group]
    .filter((form) => form !== word && form.toLowerCase() !== word.toLowerCase())
    .sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b, 'pt-BR');
    });
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function suggestByAffix(dict, word) {
  const lower = word.toLowerCase();
  const prefix = lower.slice(0, 2);
  const results = new Set();
  const maxDist = 2;

  for (const [stem, flags] of dict.stems) {
    if (!stem.startsWith(prefix)) continue;
    if (Math.abs(stem.length - lower.length) > 6) continue;

    for (const flag of flags) {
      const rules = dict.sfxByFlag.get(flag) || [];
      for (const rule of rules) {
        const formed = forwardAffixStem(stem, rule);
        if (!formed || formed === lower) continue;
        if (levenshtein(formed, lower) <= maxDist) results.add(formed);
      }
    }
  }

  return [...results];
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function suggestByNearStems(dict, word) {
  const lower = word.toLowerCase();
  const results = [];
  const maxDist = 2;
  const targetLen = lower.length;

  for (let delta = -2; delta <= 2; delta += 1) {
    const bucket = dict.stemsByLength.get(targetLen + delta) || [];
    for (const stem of bucket) {
      if (stem[0] !== lower[0]) continue;
      const dist = levenshtein(stem, lower);
      if (dist > 0 && dist <= maxDist) results.push({ word: stem, dist });
      if (results.length > 80) break;
    }
    if (results.length > 80) break;
  }

  return results
    .sort((a, b) => a.dist - b.dist || a.word.localeCompare(b.word, 'pt-BR'))
    .map((r) => r.word);
}

/**
 * @param {string} a
 * @param {string} b
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
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

/**
 * @param {string} input
 * @param {string} candidate
 */
function suggestionScore(input, candidate) {
  const a = input.toLowerCase();
  const b = candidate.toLowerCase();
  const editDist = levenshtein(a, b);
  const keyboardDist = keyboardAwareWordDistance(a, b);
  const lengthPenalty = Math.abs(a.length - b.length);
  const commonBonus = isCommonWordPt(b) ? 4 : 0;
  return editDist * 10 + keyboardDist * 2 + lengthPenalty - commonBonus;
}

/**
 * @param {string} input
 * @param {string[]} candidates
 */
function rankSuggestionCandidates(input, candidates) {
  const seen = new Set();
  return [...candidates]
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const scoreDiff = suggestionScore(input, left) - suggestionScore(input, right);
      if (scoreDiff !== 0) return scoreDiff;
      return left.localeCompare(right, 'pt-BR');
    });
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function isCandidateValid(dict, word) {
  return isCommonWordPt(word) || isWordFormValid(dict, word);
}

/**
 * @param {NonNullable<typeof engine>} dict
 * @param {string} word
 */
function buildSuggestions(dict, word) {
  const seen = new Set();
  const candidates = [];

  const collect = (candidate) => {
    const key = candidate.toLowerCase();
    if (!candidate || seen.has(key)) return;
    if (!isCandidateValid(dict, candidate)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  suggestAccent(dict, word).forEach(collect);

  const fromAffix = suggestByAffix(dict, word);
  const fromStems = suggestByNearStems(dict, word);
  rankSuggestionCandidates(word, [...fromAffix, ...fromStems]).forEach(collect);

  return rankSuggestionCandidates(word, candidates).slice(0, 5);
}

/**
 * @param {string} word
 * @param {Set<string>} whitelist
 * @param {Set<string>} [ignoredWords]
 */
export async function checkWord(word, whitelist, ignoredWords) {
  if (shouldSkipWord(word, whitelist, ignoredWords)) {
    return { valid: true, suggestions: [] };
  }
  if (isCommonWordPt(word)) {
    return { valid: true, suggestions: [] };
  }
  const dict = await loadSpellEngine();
  if (!dict) return { valid: true, suggestions: [] };
  if (isWordFormValid(dict, word)) {
    return { valid: true, suggestions: [] };
  }
  const suggestions = buildSuggestions(dict, word);
  return { valid: false, suggestions };
}

/**
 * @param {string} text
 * @param {Set<string>} whitelist
 * @param {Set<string>} [ignoredWords]
 */
export async function scanText(text, whitelist, ignoredWords) {
  if (!String(text || '').trim()) return [];
  const dict = await loadSpellEngine();
  if (!dict) return [];
  const tokens = tokenizeText(text);
  const errors = [];

  for (const token of tokens) {
    if (shouldSkipWord(token.word, whitelist, ignoredWords)) continue;
    if (isCommonWordPt(token.word)) continue;
    if (isWordFormValid(dict, token.word)) continue;
    errors.push({
      word: token.word,
      startIndex: token.startIndex,
      endIndex: token.endIndex,
      suggestions: buildSuggestions(dict, token.word),
    });
  }

  return errors;
}

/** @param {object|null|undefined} config @param {Iterable<string>} [ignoredWords] */
export function createSpellContext(config, ignoredWords) {
  return {
    whitelist: buildWhitelistFromConfig(config),
    ignoredWords: new Set(ignoredWords || []),
  };
}

export function isSpellEngineReady() {
  return Boolean(engine);
}
