/**
 * consultaFormatters v1.1.0 — datas em America/Sao_Paulo; date-only sem shift de dia
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import { isDraftTicket } from '../../api/adapters/ticketAdapter';
import { formatDateBr, formatDateTimeBr } from '../../utils/dateTimeBr';

export const CONSULTA_PRODUCT_SLUGS = [
  'emprestimo-pessoal',
  'antecipacao-salario',
  'antecipacao-irpf',
  'clube-velotax',
];

export const CONSULTA_PRODUCT_LABELS = {
  'emprestimo-pessoal': 'Empréstimo Pessoal',
  'antecipacao-salario': 'Antecipação de Salário',
  'antecipacao-irpf': 'Antecipação IRPF',
  'clube-velotax': 'Clube Velotax',
};

/** Espelha backend/src/services/consultaProductMap.ts (TABULACAO_TO_SLUG) — manter em sincronia. */
const TABULACAO_TO_SLUG = [
  { match: /empr[eé]stimo/i, slug: 'emprestimo-pessoal' },
  { match: /antecipa[cç][aã]o.{0,12}sal[aá]rio|sal[aá]rio/i, slug: 'antecipacao-salario' },
  { match: /irpf|imposto.{0,12}renda|antecipa[cç][aã]o.{0,12}ir/i, slug: 'antecipacao-irpf' },
  { match: /clube|cupom|vibes/i, slug: 'clube-velotax' },
];

export function mapTabulacaoProdutoToSlug(produto) {
  const text = String(produto ?? '').trim();
  if (!text) return null;
  const entry = TABULACAO_TO_SLUG.find(({ match }) => match.test(text));
  return entry ? entry.slug : null;
}

export function formatConsultaCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return digits || '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatConsultaMoney(value) {
  if (value == null || value === '') return '—';
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatConsultaDate(value) {
  return formatDateBr(value);
}

export function formatConsultaDateTime(value) {
  return formatDateTimeBr(value);
}

export function formatAccountStatus(status) {
  const map = {
    active: 'Ativa',
    deleted: 'Excluída',
  };
  return map[status] || status || '—';
}

export function formatInstallmentStatus(status) {
  const map = {
    paid: 'Paga',
    on_time: 'Em dia',
    overdue: 'Atrasada',
    unknown: 'Indefinida',
  };
  return map[status] || status || '—';
}

export function getOverviewProductFlags(products) {
  if (!products || typeof products !== 'object') return [];
  return [
    { key: 'emprestimoPessoal', label: 'Empréstimo Pessoal', active: Boolean(products.emprestimoPessoal) },
    { key: 'antecipacaoSalario', label: 'Antecipação Salário', active: Boolean(products.antecipacaoSalario) },
    { key: 'irpf', label: 'Antecipação IRPF', active: Boolean(products.irpf2024 || products.irpf2025 || products.irpf2026) },
    { key: 'clubeVelotax', label: 'Clube Velotax', active: Boolean(products.clubeVelotax) },
    { key: 'seguros', label: 'Seguros', active: Boolean(products.seguros) },
    { key: 'segurosAtivos', label: 'Seguros ativos', active: Boolean(products.segurosAtivos) },
    { key: 'calculadora', label: 'Calculadora', active: Boolean(products.calculadora) },
    { key: 'creditoTrabalhador', label: 'Crédito trabalhador', active: Boolean(products.creditoTrabalhador) },
  ];
}

export function getTicketRefFromTicket(ticket, client = null) {
  const ticketId = String(ticket?.id || ticket?._id || '').trim();
  const protocolo = String(
    ticket?.protocolo || ticket?.chamadoProtocolo || ticket?.lateralForm?.protocolo || '',
  ).trim();
  const lf = ticket?.lateralForm || {};
  const cpfRaw = lf.clienteCpf || lf.cpf || ticket?.clientCPF || client?.cpf || '';
  const cpf = String(cpfRaw || '').replace(/\D/g, '');
  const isDraft = isDraftTicket(ticket);
  const ticketProduct = String(lf.produto || ticket?.produto || '').trim() || undefined;

  return {
    ticketId: ticketId || undefined,
    protocolo: protocolo || undefined,
    cpf: cpf.length === 11 ? cpf : undefined,
    isDraft,
    ticketProduct,
  };
}
