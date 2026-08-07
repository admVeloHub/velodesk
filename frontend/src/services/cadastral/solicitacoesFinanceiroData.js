/**
 * Constantes — solicitações ao time Financeiro
 */
export const FINANCEIRO_SOLIC_TABS = [
  { id: 'estorno', label: 'Estorno/Cobrança' },
  { id: 'outros', label: 'Outros' },
];

export const FINANCEIRO_TIPO_OPTIONS = [
  { id: 'estorno', label: 'Estorno/Cobrança' },
  { id: 'cobranca', label: 'Cobrança indevida' },
  { id: 'outros', label: 'Outros' },
];

export function getFinanceiroTipoLabel(id) {
  return FINANCEIRO_TIPO_OPTIONS.find((o) => o.id === id)?.label || id;
}

export function getFinanceiroCategoriaTitulo(categoria) {
  if (categoria === 'documentos') return 'Solicitação de documentos';
  if (categoria === 'estorno' || categoria === 'cobranca') return 'Estorno/Cobrança';
  return 'Solicitação Financeiro';
}
