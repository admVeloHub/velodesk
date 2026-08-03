/**
 * consultaFormatters v1.0.1 — CPF do ticket + client para rascunhos
 * VERSION: v1.0.1 | DATE: 2026-08-03
 */
import { isDraftTicket } from '../../api/adapters/ticketAdapter';

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
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

export function formatConsultaDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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
