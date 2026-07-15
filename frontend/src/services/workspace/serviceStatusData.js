/**
 * serviceStatusData v1.0.0 — produtos da empresa para Painel 360°
 * VERSION: v1.0.0 | DATE: 2026-07-15
 */

/** Rótulos curtos exibidos nas tags compactas do Painel 360° */
const SHORT_LABELS = {
  'Crédito Pessoal': 'Cr. Pessoal',
  'Pagamento Antecipado': 'Pgto Antec',
  'Pagamento Antecipado (Pgto Antec)': 'Pgto Antec',
  'Antecipação do Imposto de Renda': 'Antecipação',
  'Antecipação de salário': 'Antec. salário',
  'Seguro Celular': 'Seguro Cel',
  'Empréstimo Pessoal': 'Empr. Pessoal',
  'Clube Velotax e Dívida Zero': 'Clube Velotax',
};

export const FALLBACK_SERVICE_STATUS = [
  { id: 'credito-pessoal', label: 'Cr. Pessoal', ativo: true },
  { id: 'pgto-antec', label: 'Pgto Antec', ativo: true },
  { id: 'antecipacao', label: 'Antecipação', ativo: false },
  { id: 'prestamista', label: 'Prestamista', ativo: false },
  { id: 'seguro-cel', label: 'Seguro Cel', ativo: false },
  { id: 'perda-renda', label: 'Perda de Renda', ativo: false },
  { id: 'cupons', label: 'Cupons', ativo: false },
  { id: 'seguro-pessoal', label: 'Seguro Pessoal', ativo: false },
];

export function shortServiceLabel(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  if (SHORT_LABELS[value]) return SHORT_LABELS[value];
  if (value.length <= 16) return value;
  return value.replace(/\s*\([^)]*\)\s*$/, '').trim().slice(0, 16);
}

export function mapProdutosToServiceStatus(produtos) {
  const list = Array.isArray(produtos) ? produtos : [];
  if (!list.length) return FALLBACK_SERVICE_STATUS;

  return [...list]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.produto || '').localeCompare(String(b.produto || ''), 'pt-BR'))
    .map((item) => ({
      id: item.id || item._id || item.produto,
      label: shortServiceLabel(item.produto),
      ativo: item.ativo !== false,
    }))
    .filter((item) => item.label);
}
