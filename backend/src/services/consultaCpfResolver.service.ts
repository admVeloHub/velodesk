/** consultaCpfResolver v1.0.3 — rascunho não consulta MongoDB */
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1 } from '../models/ChamadoN1';
import { findClienteByCpf, findClienteById, getPrimaryDados, normalizeCpf } from './cliente.service';
import { mapTabulacaoProdutoToSlug, type ConsultaProductSlug } from './consultaProductMap';

export class ConsultaCpfError extends Error {
  status: number;

  code: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code || (status === 422 ? 'missing_cpf' : status === 404 ? 'ticket_not_found' : 'consulta_error');
  }
}

export interface ResolveConsultaInput {
  ticketId?: string;
  protocolo?: string;
  /** CPF do painel lateral — obrigatório em rascunho; fallback em ticket persistido */
  cpf?: string;
  isDraft?: boolean;
  ticketProduct?: string;
}

export interface ResolvedConsultaContext {
  cpf: string;
  cpfFormatted: string;
  protocolo: string;
  ticketProductSlug: ConsultaProductSlug | null;
  ticketProductLabel: string;
}

function formatCpfDisplay(cpf: string): string {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return digits;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function isValidCpfDigits(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += parseInt(digits[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += parseInt(digits[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(digits[10], 10);
}

function assertValidCpf(cpfRaw: unknown): string {
  const cpf = normalizeCpf(cpfRaw);
  if (!cpf) {
    throw new ConsultaCpfError(
      422,
      'Informe o CPF no cadastro do cliente para consultar.',
      'missing_cpf',
    );
  }
  if (!isValidCpfDigits(cpf)) {
    throw new ConsultaCpfError(
      422,
      'O CPF informado no cadastro do cliente não é válido.',
      'invalid_cpf',
    );
  }
  return cpf;
}

function isDraftTicketId(ticketId?: string): boolean {
  return String(ticketId ?? '').trim().startsWith('draft-');
}

async function loadChamado(ticketId?: string, protocolo?: string): Promise<IChamadoN1 | null> {
  const id = String(ticketId ?? '').trim();
  const proto = String(protocolo ?? '').trim();

  if (id && !isDraftTicketId(id) && mongoose.Types.ObjectId.isValid(id)) {
    const chamado = await ChamadoN1.findById(id);
    if (chamado) return chamado;
  }

  if (proto) {
    const chamado = await ChamadoN1.findOne({ chamadoProtocolo: proto });
    if (chamado) return chamado;
  }

  return null;
}

function extractCpfFromChamado(chamado: IChamadoN1): string {
  const ref = chamado.cliente?.[0];
  const tab = chamado.tabulacao?.[0];
  const lateralCpf = (tab as { clienteCpf?: string; cpf?: string } | undefined)?.clienteCpf
    ?? (tab as { cpf?: string } | undefined)?.cpf;

  const candidates = [
    ref?.clienteCpf,
    lateralCpf,
  ];

  for (const raw of candidates) {
    const cpf = normalizeCpf(raw);
    if (cpf) return cpf;
  }

  return '';
}

function buildContextFromCpf(
  cpf: string,
  protocolo: string,
  ticketProductLabel: string,
): ResolvedConsultaContext {
  return {
    cpf,
    cpfFormatted: formatCpfDisplay(cpf),
    protocolo,
    ticketProductSlug: mapTabulacaoProdutoToSlug(ticketProductLabel),
    ticketProductLabel,
  };
}

export async function resolveConsultaContext(input: ResolveConsultaInput): Promise<ResolvedConsultaContext> {
  const ticketId = String(input.ticketId ?? '').trim() || undefined;
  const protocoloInput = String(input.protocolo ?? '').trim() || undefined;
  const ticketProductLabel = String(input.ticketProduct ?? '').trim();
  const draft = Boolean(input.isDraft) || isDraftTicketId(ticketId);

  if (draft) {
    const cpf = assertValidCpf(input.cpf);
    const protocolo = protocoloInput || ticketId || 'draft';
    return buildContextFromCpf(cpf, protocolo, ticketProductLabel);
  }

  const chamado = await loadChamado(ticketId, protocoloInput);

  if (!chamado) {
    if (input.cpf) {
      const cpf = assertValidCpf(input.cpf);
      const protocolo = protocoloInput || ticketId || 'desk';
      return buildContextFromCpf(cpf, protocolo, ticketProductLabel);
    }
    throw new ConsultaCpfError(404, 'Ticket não encontrado.', 'ticket_not_found');
  }

  let cpf = extractCpfFromChamado(chamado);

  const ref = chamado.cliente?.[0];
  if (ref?.clienteId || ref?.clienteCpf) {
    const cliente = ref.clienteId
      ? await findClienteById(ref.clienteId)
      : await findClienteByCpf(cpf);
    const dados = getPrimaryDados(cliente);
    if (dados?.clienteCpf) {
      cpf = normalizeCpf(dados.clienteCpf);
    }
  }

  if (!cpf && input.cpf) {
    cpf = normalizeCpf(input.cpf);
  }

  if (!cpf) {
    throw new ConsultaCpfError(
      422,
      'Informe o CPF no cadastro do cliente para consultar.',
      'missing_cpf',
    );
  }

  if (!isValidCpfDigits(cpf)) {
    throw new ConsultaCpfError(
      422,
      'O CPF informado no cadastro do cliente não é válido.',
      'invalid_cpf',
    );
  }

  const tabProduto = chamado.tabulacao?.[0]?.produto ?? ticketProductLabel;

  return {
    cpf,
    cpfFormatted: formatCpfDisplay(cpf),
    protocolo: chamado.chamadoProtocolo,
    ticketProductSlug: mapTabulacaoProdutoToSlug(tabProduto),
    ticketProductLabel: tabProduto,
  };
}
