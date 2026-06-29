/**
 * parseHunspell v1.0.1 — parser leve de aff/dic Hunspell PT-BR
 * VERSION: v1.0.1 | DATE: 2026-06-26
 */

/** @typedef {{ strip: string, add: string, match: string|null, flag: string, type: 'SFX'|'PFX' }} AffixRule */

/**
 * @param {string} affText
 * @returns {{ accentMaps: string[][], sfxRules: AffixRule[], pfxRules: AffixRule[] }}
 */
export function parseAff(affText) {
  const accentMaps = [];
  const sfxRules = [];
  const pfxRules = [];
  const lines = affText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('MAP ')) {
      const parts = line.slice(4).trim().split(/\s+/);
      if (parts.length >= 2) accentMaps.push(parts);
      continue;
    }

    const header = line.match(/^(SFX|PFX)\s+(\S+)\s+([YN])\s+(\d+)$/);
    if (!header) continue;

    const [, type, flag, , countRaw] = header;
    const count = parseInt(countRaw, 10);
    const bucket = type === 'SFX' ? sfxRules : pfxRules;

    for (let j = 0; j < count && i + 1 + j < lines.length; j += 1) {
      const ruleLine = lines[i + 1 + j].trim();
      const parts = ruleLine.split(/\s+/);
      if (parts.length < 5 || parts[0] !== type || parts[1] !== flag) continue;
      const strip = parts[2];
      const add = parts[3];
      const matchRaw = parts[4];
      bucket.push({
        type,
        flag,
        strip: strip === '0' ? '' : strip,
        add: add === '0' ? '' : add,
        match: matchRaw && matchRaw !== '.' ? matchRaw : null,
      });
    }
    i += count;
  }

  return { accentMaps, sfxRules, pfxRules };
}

/**
 * @param {string} dicText
 * @returns {Map<string, Set<string>>}
 */
export function parseDicStems(dicText) {
  const stems = new Map();
  const lines = dicText.split(/\r?\n/);
  for (let idx = 1; idx < lines.length; idx += 1) {
    const line = lines[idx].trim();
    if (!line) continue;
    const slash = line.indexOf('/');
    const word = slash >= 0 ? line.slice(0, slash) : line;
    const flagsRaw = slash >= 0 ? line.slice(slash + 1) : '';
    if (!word || /^\d+$/.test(word)) continue;
    const flags = flagsRaw ? [...flagsRaw.replace(/[^A-Za-z]/g, '')] : [];
    const key = word.toLowerCase();
    if (!stems.has(key)) stems.set(key, new Set());
    const flagSet = stems.get(key);
    flags.forEach((f) => flagSet.add(f));
    if (!flags.length) flagSet.add('');
  }
  return stems;
}

/**
 * @param {string} stem
 * @param {string|null} matchPattern
 */
export function stemMatches(stem, matchPattern) {
  if (!matchPattern) return true;
  if (matchPattern.startsWith('[') && matchPattern.endsWith(']')) {
    const inner = matchPattern.slice(1, -1);
    const last = stem.slice(-1);
    return inner.includes(last);
  }
  return stem.endsWith(matchPattern);
}

/**
 * @param {string} word
 * @param {string} strip
 * @param {string} add
 */
export function reverseAffixStem(word, strip, add) {
  if (add && !word.endsWith(add)) return null;
  const base = add ? word.slice(0, word.length - add.length) : word;
  return strip ? base + strip : base;
}

/**
 * @param {string} stem
 * @param {AffixRule} rule
 */
export function forwardAffixStem(stem, rule) {
  if (rule.match && !stemMatches(stem, rule.match)) return null;
  if (rule.strip && !stem.endsWith(rule.strip)) return null;
  const stripped = rule.strip ? stem.slice(0, stem.length - rule.strip.length) : stem;
  return rule.add ? stripped + rule.add : stripped;
}

/**
 * @param {string} text
 * @param {string[][]} accentMaps
 */
export function buildAccentGroups(text, accentMaps) {
  const groups = new Map();
  const add = (form) => {
    const key = stripAccents(form);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(form);
    groups.get(key).add(form.toLowerCase());
  };

  for (const line of text.split(/\r?\n/)) {
    const word = line.split('/')[0].trim();
    if (word && !/^\d+$/.test(word)) add(word);
  }

  for (const map of accentMaps) {
    map.forEach((variant) => add(variant));
  }

  return groups;
}

/** @param {string} value */
export function stripAccents(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
