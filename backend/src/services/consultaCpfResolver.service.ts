/** consultaCpfResolver v1.0.1 — CPF formatado para exibição no Desk */
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1 } from '../models/ChamadoN1';
import { findClienteByCpf, findClienteById, getPrimaryDados, normalizeCpf } from './cliente.service';
import { mapTabulacaoProdutoToSlug, type ConsultaProductSlug } from './consultaProductMap';

export class ConsultaCpfError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ResolvedConsultaContext {
  cpf: string;
  cpfFormatted: string;
  chamado: IChamadoN1;
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

async function loadChamado(ticketId?: string, protocolo?: string): Promise<IChamadoN1> {
  const id = String(ticketId ?? '').trim();
  const proto = String(protocolo ?? '').trim();

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const chamado = await ChamadoN1.findById(id);
    if (chamado) return chamado;
  }

  if (proto) {
    const chamado = await ChamadoN1.findOne({ chamadoProtocolo: proto });
    if (chamado) return chamado;
  }

  throw new ConsultaCpfError(404, 'Ticket não encontrado.');
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

export async function resolveConsultaContext(input: {
  ticketId?: string;
  protocolo?: string;
}): Promise<ResolvedConsultaContext> {
  const chamado = await loadChamado(input.ticketId, input.protocolo);
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

  if (!cpf) {
    throw new ConsultaCpfError(
      422,
      'Informe o CPF no cadastro do cliente para consultar.',
    );
  }

  if (!isValidCpfDigits(cpf)) {
    throw new ConsultaCpfError(
      422,
      'O CPF informado no cadastro do cliente não é válido.',
    );
  }

  const tabProduto = chamado.tabulacao?.[0]?.produto ?? '';
  const ticketProductSlug = mapTabulacaoProdutoToSlug(tabProduto);

  return {
    cpf,
    cpfFormatted: formatCpfDisplay(cpf),
    chamado,
    protocolo: chamado.chamadoProtocolo,
    ticketProductSlug,
    ticketProductLabel: tabProduto,
  };
}
