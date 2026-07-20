/** normalizeFuncao v1.0.0 — slug de função VeloHub → Desk (login/RBAC) */

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
