import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../node_modules/dictionary-pt-br');
const dic = readFileSync(join(dir, 'index.dic'), 'utf8');

function stripAccents(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const t0 = Date.now();
const wordSet = new Set();
const accentForms = new Map();

for (const line of dic.split('\n')) {
  const raw = line.split('/')[0].trim();
  if (!raw || raw.length < 2 || /^\d+$/.test(raw)) continue;
  wordSet.add(raw);
  wordSet.add(raw.toLowerCase());
  const norm = stripAccents(raw);
  if (!accentForms.has(norm)) accentForms.set(norm, new Set());
  accentForms.get(norm).add(raw);
}
console.log('parsed', wordSet.size, 'entries in', Date.now() - t0, 'ms');

function isCorrect(word) {
  if (wordSet.has(word) || wordSet.has(word.toLowerCase())) return true;
  const norm = stripAccents(word);
  const forms = accentForms.get(norm);
  if (!forms) return false;
  return forms.has(word) || forms.has(word.toLowerCase());
}

function suggest(word, limit = 5) {
  const norm = stripAccents(word);
  const forms = accentForms.get(norm);
  if (forms && !forms.has(word) && !forms.has(word.toLowerCase())) {
    return [...forms].slice(0, limit);
  }
  const lower = word.toLowerCase();
  const results = [];
  const maxDist = 2;
  for (const candidate of wordSet) {
    if (candidate.length < 3) continue;
    if (Math.abs(candidate.length - lower.length) > maxDist) continue;
    if (candidate[0]?.toLowerCase() !== lower[0]) continue;
    if (levenshtein(lower, candidate.toLowerCase()) <= maxDist) {
      results.push({ candidate, dist: levenshtein(lower, candidate.toLowerCase()) });
    }
    if (results.length > 200) break;
  }
  return results.sort((a, b) => a.dist - b.dist).slice(0, limit).map((r) => r.candidate);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

const words = ['atendimeto', 'atendimento', 'obrigadu', 'informacao', 'informação', 'voce', 'você', 'nao', 'não', 'xkjhfg'];
for (const w of words) {
  console.log(w, 'ok:', isCorrect(w), 'suggest:', suggest(w));
}
