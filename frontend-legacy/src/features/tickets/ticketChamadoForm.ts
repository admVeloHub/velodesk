/** ticketChamadoForm v1.0.0 — leitura/escrita dos campos do schema chamados_n1 */
import { Ticket } from '../../types';

export interface ChamadoFormState {
  clienteCpf: string;
  clienteNome: string;
  clienteEmail: string[];
  clienteTelefone: string[];
  tipoChamado: string;
  produto: string;
  motivo: string;
  detalhe: string;
  responsavel: string;
  atribuido: string;
}

const EMPTY_FORM: ChamadoFormState = {
  clienteCpf: '',
  clienteNome: '',
  clienteEmail: [''],
  clienteTelefone: [''],
  tipoChamado: '',
  produto: '',
  motivo: '',
  detalhe: '',
  responsavel: '',
  atribuido: '',
};

function normalizeList(value: unknown, fallback = ''): string[] {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    return items.length > 0 ? items : [fallback];
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [fallback];
}

export function readChamadoForm(ticket: Ticket): ChamadoFormState {
  const lf = ticket.lateralForm || {};

  return {
    clienteCpf: String(lf.clienteCpf ?? lf.cpf ?? ticket.clientCPF ?? ''),
    clienteNome: String(lf.clienteNome ?? ticket.clientName ?? ''),
    clienteEmail: normalizeList(lf.clienteEmail),
    clienteTelefone: normalizeList(lf.clienteTelefone),
    tipoChamado: String(lf.tipoChamado ?? lf.classificacaoTipo ?? ''),
    produto: String(lf.produto ?? ''),
    motivo: String(lf.motivo ?? ''),
    detalhe: String(lf.detalhe ?? ''),
    responsavel: String(lf.responsavel ?? ticket.responsibleAgent ?? ''),
    atribuido: String(lf.atribuido ?? ''),
  };
}

export function chamadoFormToPayload(form: Partial<ChamadoFormState>): Record<string, unknown> {
  const next = { ...readChamadoForm({ _id: '', title: '', status: '', priority: '' }), ...form };

  return {
    clienteCpf: next.clienteCpf,
    clienteNome: next.clienteNome,
    clienteEmail: next.clienteEmail.map((item) => item.trim()).filter(Boolean),
    clienteTelefone: next.clienteTelefone.map((item) => item.trim()).filter(Boolean),
    tipoChamado: next.tipoChamado,
    classificacaoTipo: next.tipoChamado,
    produto: next.produto,
    motivo: next.motivo,
    detalhe: next.detalhe,
    responsavel: next.responsavel,
    atribuido: next.atribuido,
    cpf: next.clienteCpf,
  };
}

export function mergeChamadoForm(
  ticket: Ticket,
  partial: Partial<ChamadoFormState>
): Record<string, unknown> {
  return chamadoFormToPayload({ ...readChamadoForm(ticket), ...partial });
}

export { EMPTY_FORM };
