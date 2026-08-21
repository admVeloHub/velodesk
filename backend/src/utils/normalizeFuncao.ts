/** normalizeFuncao v1.3.1 — map grupo produtos em normalizeAtribuidoValue */

export function normalizeFuncao(value: unknown): string {
  const base = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/\s/g, '-');

  const aliases: Record<string, string> = {
    produto: 'produtos',
    produtos: 'produtos',
    'time-produto': 'produtos',
    'time-produtos': 'produtos',
    'time-de-produto': 'produtos',
    'time-de-produtos': 'produtos',
  };
  if (aliases[base]) return aliases[base];
  if (base.includes('produto') && !base.includes('atendimento')) return 'produtos';
  return base;
}

function readFuncaoFromAtuacaoItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';
  const obj = item as Record<string, unknown>;
  const raw = obj.funcao ?? obj.slug ?? obj.id ?? obj.nome ?? obj.label ?? obj.value ?? '';
  return String(raw || '').trim();
}

export function extractFuncoes(atuacao: unknown): string[] {
  if (Array.isArray(atuacao)) {
    return atuacao
      .map(readFuncaoFromAtuacaoItem)
      .map(normalizeFuncao)
      .filter(Boolean);
  }
  if (typeof atuacao === 'string' && atuacao.trim()) {
    return [normalizeFuncao(atuacao)];
  }
  if (atuacao && typeof atuacao === 'object') {
    const single = readFuncaoFromAtuacaoItem(atuacao);
    if (single) return [normalizeFuncao(single)];
  }
  return [];
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
      produtos: 'produtos',
      suporte: 'suporte',
    };
    const funcao = map[slug.toLowerCase()] || slug;
    return `funcao:${funcao}`;
  }
  return raw;
}
