/** normalizeFuncao v1.0.0 — slug de função VeloHub → Desk RBAC */

export function normalizeFuncao(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s/g, '-');
}

export function extractFuncoes(atuacao: unknown): string[] {
  if (!Array.isArray(atuacao)) return [];
  return atuacao
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'funcao' in item) {
        return (item as { funcao?: string }).funcao;
      }
      return '';
    })
    .map(normalizeFuncao)
    .filter(Boolean);
}

/** Resolve função primária — maior nível entre as atribuídas */
export function resolvePrimaryFuncao(
  funcoes: string[],
  nivelBySlug: Map<string, number>,
): string {
  if (!funcoes.length) return 'atendimento';

  let best = funcoes[0];
  let bestNivel = nivelBySlug.get(best) ?? 0;

  for (const f of funcoes) {
    const nivel = nivelBySlug.get(f) ?? 0;
    if (nivel > bestNivel) {
      best = f;
      bestNivel = nivel;
    }
  }
  return best;
}

/** Converte atribuido legado grupo: → funcao: */
export function normalizeAtribuidoValue(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('grupo:')) {
    const slug = raw.slice(6);
    const map: Record<string, string> = {
      n1: 'atendimento',
      n2: 'n2',
      financeiro: 'financeiro',
      suporte: 'suporte',
    };
    const funcao = map[slug.toLowerCase()] || slug;
    return `funcao:${funcao}`;
  }
  return raw;
}
