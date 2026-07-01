/**
 * spellcheckSuggestionRank v1.0.0 — ranking de sugestões LT para atendimento
 * VERSION: v1.0.0 | DATE: 2026-07-01
 */

/** Vocabulário frequente no desk — prioriza typo → palavra esperada (ex.: criente → cliente). */
const ATTENDANCE_LEXICON = new Set([
  'cliente', 'clientes', 'prosseguir', 'continuar', 'atendimento', 'conta', 'contas',
  'verificar', 'informação', 'informações', 'dúvida', 'dúvidas', 'obrigado', 'obrigada',
  'prezado', 'prezada', 'senhor', 'senhora', 'protocolo', 'chamado', 'suporte',
]);

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

function scoreSuggestion(input: string, candidate: string): number {
  const a = input.toLowerCase();
  const b = candidate.toLowerCase();
  let score = levenshtein(a, b) * 10;
  if (candidate.includes('-') && !input.includes('-')) score += 25;
  if (/\s/.test(candidate) && !/\s/.test(input)) score += 20;
  if (ATTENDANCE_LEXICON.has(b)) score -= 18;
  score += Math.abs(a.length - b.length) * 2;
  return score;
}

function isPlausibleSuggestion(input: string, candidate: string): boolean {
  const a = input.toLowerCase();
  const b = candidate.toLowerCase();
  if (!candidate || a === b) return false;
  if (!input.includes('-') && candidate.includes('-')) return false;
  if (!/\s/.test(input) && /\s/.test(candidate.trim())) return false;
  if (levenshtein(a, b.replace(/-/g, '')) > 3) return false;
  return true;
}

/** Reordena sugestões do LT — typo de atendimento antes de formas verbais absurdas. */
export function rankSpellSuggestions(input: string, suggestions: string[]): string[] {
  const seen = new Set<string>();
  return suggestions
    .filter((item) => isPlausibleSuggestion(input, item))
    .sort((left, right) => {
      const diff = scoreSuggestion(input, left) - scoreSuggestion(input, right);
      if (diff !== 0) return diff;
      return left.localeCompare(right, 'pt-BR');
    })
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}
