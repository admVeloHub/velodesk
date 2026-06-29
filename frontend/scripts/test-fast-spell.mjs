import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseAff, parseDicStems, buildAccentGroups, reverseAffixStem, stemMatches, forwardAffixStem, stripAccents } from '../src/services/spellcheck/parseHunspell.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/dictionary-pt-br');
const affText = readFileSync(join(root, 'index.aff'), 'utf8');
const dicText = readFileSync(join(root, 'index.dic'), 'utf8');
const { accentMaps, sfxRules } = parseAff(affText);
const stems = parseDicStems(dicText);
const accentGroups = buildAccentGroups(dicText, accentMaps);
const sfxByFlag = new Map();
for (const rule of sfxRules) {
  if (!sfxByFlag.has(rule.flag)) sfxByFlag.set(rule.flag, []);
  sfxByFlag.get(rule.flag).push(rule);
}

function levenshtein(a, b) {
  const m = a.length; const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  }
  return dp[m][n];
}

function isValid(word) {
  const lower = word.toLowerCase();
  if (stems.has(lower)) return true;
  for (const [flag, rules] of sfxByFlag) {
    for (const rule of rules) {
      const candidate = reverseAffixStem(lower, rule.strip, rule.add);
      if (!candidate) continue;
      if (rule.match && !stemMatches(candidate, rule.match)) continue;
      if (stems.get(candidate)?.has(flag)) return true;
    }
  }
  const group = accentGroups.get(stripAccents(word));
  if (group && (group.has(word) || group.has(lower))) return true;
  return false;
}

function suggest(word) {
  const lower = word.toLowerCase();
  const out = new Set();
  for (const [stem, flags] of stems) {
    if (Math.abs(stem.length - lower.length) > 3) continue;
    if (stem[0] !== lower[0]) continue;
    if (levenshtein(stem, lower) > 2) continue;
    for (const flag of flags) {
      for (const rule of (sfxByFlag.get(flag) || [])) {
        const formed = forwardAffixStem(stem, rule);
        if (formed && levenshtein(formed, lower) <= 2) out.add(formed);
      }
    }
  }
  const norm = stripAccents(word);
  const group = accentGroups.get(norm);
  if (group) group.forEach((f) => { if (f !== word) out.add(f); });
  return [...out].slice(0,5);
}

console.log('atendimeto', isValid('atendimeto'), suggest('atendimeto'));
console.log('informacao', isValid('informacao'), suggest('informacao'));
console.log('voce', isValid('voce'), suggest('voce'));

const text = 'Ola voce, verificando sua solicitacao com atendimeto.';
for (const token of text.match(/[a-zA-ZÀ-ÿ]+/g) || []) {
  if (!isValid(token)) console.log('ERR', token, suggest(token));
}
