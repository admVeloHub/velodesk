/**
 * criticalKeywords.service v1.0.0 — detecção de palavras críticas (pré-LLM)
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */

const CRITICAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'estorno', pattern: /\bestorno\b/i },
  { label: 'bacen', pattern: /\b(bacen|banco\s*central)\b/i },
  { label: 'procon', pattern: /\bprocon\b/i },
  { label: 'processo', pattern: /\b(processo|ação\s*judicial|judicializar|processar)\b/i },
  { label: 'denúncia', pattern: /\b(denúncia|denuncia)\b/i },
  { label: 'fraude', pattern: /\b(fraude|golpe|chargeback)\b/i },
  { label: 'ameaça', pattern: /\b(ameaça|ameaca|attrito)\b/i },
  { label: 'advogado', pattern: /\b(advogado|justiça|justica)\b/i },
  { label: 'consumidor.gov', pattern: /\bconsumidor\.gov\b/i },
  { label: 'reclame aqui', pattern: /\breclame\s*aqui\b/i },
  { label: 'polícia', pattern: /\b(polícia|policia|boletim\s*de\s*ocorrência)\b/i },
  { label: 'inadimplência', pattern: /\binadimpl[eê]ncia\s*grave\b/i },
  { label: 'calote', pattern: /\bcalote\b/i },
];

export function detectCriticalKeywords(...texts: Array<string | undefined>): string[] {
  const combined = texts.filter(Boolean).join('\n');
  if (!combined.trim()) return [];

  const found: string[] = [];
  for (const { label, pattern } of CRITICAL_PATTERNS) {
    if (pattern.test(combined)) found.push(label);
  }
  return [...new Set(found)];
}

export function hasCriticalKeywords(...texts: Array<string | undefined>): boolean {
  return detectCriticalKeywords(...texts).length > 0;
}
