/** consultaProductMap v1.0.0 — tabulação Desk → slug Customer Data API */
export const CONSULTA_PRODUCT_SLUGS = [
  'emprestimo-pessoal',
  'antecipacao-salario',
  'antecipacao-irpf',
  'clube-velotax',
] as const;

export type ConsultaProductSlug = (typeof CONSULTA_PRODUCT_SLUGS)[number];

export const CONSULTA_PRODUCT_LABELS: Record<ConsultaProductSlug, string> = {
  'emprestimo-pessoal': 'Empréstimo Pessoal',
  'antecipacao-salario': 'Antecipação de Salário',
  'antecipacao-irpf': 'Antecipação IRPF',
  'clube-velotax': 'Clube Velotax',
};

const TABULACAO_TO_SLUG: Array<{ match: RegExp; slug: ConsultaProductSlug }> = [
  { match: /empr[eé]stimo/i, slug: 'emprestimo-pessoal' },
  { match: /antecipa[cç][aã]o.{0,12}sal[aá]rio|sal[aá]rio/i, slug: 'antecipacao-salario' },
  { match: /irpf|imposto.{0,12}renda|antecipa[cç][aã]o.{0,12}ir/i, slug: 'antecipacao-irpf' },
  { match: /clube|cupom|vibes/i, slug: 'clube-velotax' },
];

const SLUG_TO_API_PATH: Record<ConsultaProductSlug, string> = {
  'emprestimo-pessoal': '/v1/products/emprestimo-pessoal',
  'antecipacao-salario': '/v1/products/antecipacao-salario',
  'antecipacao-irpf': '/v1/products/antecipacao-irpf',
  'clube-velotax': '/v1/products/clube-velotax',
};

const SLUG_TO_OVERVIEW_FLAG: Record<ConsultaProductSlug, (products: Record<string, boolean>) => boolean> = {
  'emprestimo-pessoal': (p) => Boolean(p.emprestimoPessoal),
  'antecipacao-salario': (p) => Boolean(p.antecipacaoSalario),
  'antecipacao-irpf': (p) => Boolean(p.irpf2024 || p.irpf2025 || p.irpf2026),
  'clube-velotax': (p) => Boolean(p.clubeVelotax),
};

export function isConsultaProductSlug(value: string): value is ConsultaProductSlug {
  return (CONSULTA_PRODUCT_SLUGS as readonly string[]).includes(value);
}

export function mapTabulacaoProdutoToSlug(produto: unknown): ConsultaProductSlug | null {
  const text = String(produto ?? '').trim();
  if (!text) return null;
  for (const entry of TABULACAO_TO_SLUG) {
    if (entry.match.test(text)) return entry.slug;
  }
  return null;
}

export function getProductApiPath(slug: ConsultaProductSlug): string {
  return SLUG_TO_API_PATH[slug];
}

export function shouldPrefetchProduct(
  slug: ConsultaProductSlug,
  products: Record<string, boolean> | null | undefined,
  ticketProductSlug: ConsultaProductSlug | null,
): boolean {
  if (ticketProductSlug === slug) return true;
  if (!products) return false;
  return SLUG_TO_OVERVIEW_FLAG[slug](products);
}

export function listPendingExpandSlugs(
  prefetched: Set<ConsultaProductSlug>,
): ConsultaProductSlug[] {
  return CONSULTA_PRODUCT_SLUGS.filter((slug) => !prefetched.has(slug));
}
