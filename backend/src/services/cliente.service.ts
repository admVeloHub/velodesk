/** cliente.service v1.2.0 — inbound e-mail: lookup por e-mail, sem upsert sem CPF */
import mongoose from 'mongoose';
import { getClienteModel, ICliente, IClienteDados } from '../models/Cliente';
import type { IClienteRef } from '../models/ChamadoN1';

export function normalizeCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function parseEmailAddress(raw: unknown): { email: string; name?: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { email: '' };

  const bracketMatch = text.match(/^(.+?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim().replace(/^["']|["']$/g, '');
    return { email: normalizeEmail(bracketMatch[2]), name: name || undefined };
  }

  return { email: normalizeEmail(text) };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStringList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return fallback;
}

function dadosFromBody(body: Record<string, unknown>): IClienteDados | null {
  const lateral = (body.lateralForm ?? {}) as Record<string, unknown>;
  const cpf = normalizeCpf(body.clientCPF ?? lateral.clienteCpf ?? lateral.cpf);
  const nome = String(body.clientName ?? lateral.clienteNome ?? '').trim();
  const emailLista = normalizeStringList(lateral.clienteEmail);
  const telLista = normalizeStringList(lateral.clienteTelefone);

  if (!cpf && !nome) return null;

  const dados: IClienteDados = {
    clienteCpf: cpf,
    clienteNome: nome,
    clienteEmail: { lista: emailLista },
    clienteTelefone: { lista: telLista },
  };

  if (!cpf) {
    delete (dados as { clienteCpf?: string }).clienteCpf;
  }

  return dados;
}

export function getPrimaryDados(cliente: ICliente | null): IClienteDados | null {
  if (!cliente?.clienteDados?.length) return null;
  return cliente.clienteDados[0];
}

export async function findClienteByCpf(cpfRaw: unknown): Promise<ICliente | null> {
  const cpf = normalizeCpf(cpfRaw);
  if (!cpf) return null;
  const Cliente = getClienteModel();
  return Cliente.findOne({ 'clienteDados.clienteCpf': cpf });
}

export async function findClienteByEmail(emailRaw: unknown): Promise<ICliente | null> {
  const email = normalizeEmail(emailRaw);
  if (!email) return null;
  const Cliente = getClienteModel();
  const exact = await Cliente.findOne({ 'clienteDados.clienteEmail.lista': email });
  if (exact) return exact;

  return Cliente.findOne({
    'clienteDados.clienteEmail.lista': { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') },
  });
}

export async function resolveClienteRefFromEmail(
  emailRaw: unknown,
  displayName?: string
): Promise<IClienteRef | null> {
  const parsed = parseEmailAddress(emailRaw);
  const email = parsed.email;
  if (!email) return null;

  const cliente = await findClienteByEmail(email);
  if (!cliente) return null;

  const dados = getPrimaryDados(cliente);
  const cpf = normalizeCpf(dados?.clienteCpf);
  return {
    clienteCpf: cpf,
    clienteId: cliente._id as mongoose.Types.ObjectId,
  };
}

export async function findClienteById(id: unknown): Promise<ICliente | null> {
  const idStr = String(id ?? '').trim();
  if (!idStr || !mongoose.Types.ObjectId.isValid(idStr)) return null;
  const Cliente = getClienteModel();
  return Cliente.findById(idStr);
}

export async function loadDadosForRef(ref?: IClienteRef | null): Promise<IClienteDados | null> {
  if (!ref) return null;

  if (ref.clienteId) {
    const byId = await findClienteById(ref.clienteId);
    const dados = getPrimaryDados(byId);
    if (dados) return dados;
  }

  if (ref.clienteCpf) {
    const byCpf = await findClienteByCpf(ref.clienteCpf);
    return getPrimaryDados(byCpf);
  }

  return null;
}

function applyDadosToCliente(existing: ICliente, dados: IClienteDados): void {
  if (!existing.clienteDados?.length) {
    const entry: Record<string, unknown> = {
      clienteNome: dados.clienteNome,
      clienteEmail: dados.clienteEmail,
      clienteTelefone: dados.clienteTelefone,
    };
    if (dados.clienteCpf) entry.clienteCpf = dados.clienteCpf;
    existing.clienteDados = [entry as unknown as IClienteDados];
    return;
  }
  if (dados.clienteNome) existing.clienteDados[0].clienteNome = dados.clienteNome;
  if (dados.clienteCpf) existing.clienteDados[0].clienteCpf = dados.clienteCpf;
  if (dados.clienteEmail.lista.length) existing.clienteDados[0].clienteEmail = dados.clienteEmail;
  if (dados.clienteTelefone.lista.length) existing.clienteDados[0].clienteTelefone = dados.clienteTelefone;
}

export async function upsertClienteFromBody(body: Record<string, unknown>): Promise<ICliente | null> {
  const dados = dadosFromBody(body);
  if (!dados) return null;

  const Cliente = getClienteModel();
  const cpf = dados.clienteCpf || normalizeCpf(body.clientCPF);
  const clienteIdRaw = body.clienteId ?? (body.cliente as { clienteId?: unknown }[] | undefined)?.[0]?.clienteId;

  if (clienteIdRaw && mongoose.Types.ObjectId.isValid(String(clienteIdRaw))) {
    const byId = await findClienteById(clienteIdRaw);
    if (byId) {
      applyDadosToCliente(byId, dados);
      await byId.save();
      return byId;
    }
  }

  if (cpf) {
    const existing = await Cliente.findOne({ 'clienteDados.clienteCpf': cpf });
    if (existing) {
      applyDadosToCliente(existing, dados);
      await existing.save();
      return existing;
    }
  }

  const emails = dados.clienteEmail?.lista ?? [];
  if (!cpf && emails.length) {
    const byEmail = await findClienteByEmail(emails[0]);
    if (byEmail) {
      applyDadosToCliente(byEmail, dados);
      await byEmail.save();
      return byEmail;
    }
    return null;
  }

  if (!cpf) return null;

  const createDados: Record<string, unknown> = {
    clienteNome: dados.clienteNome,
    clienteEmail: dados.clienteEmail,
    clienteTelefone: dados.clienteTelefone,
  };
  if (cpf) createDados.clienteCpf = cpf;

  return Cliente.create({ clienteDados: [createDados], atendimentoHistorico: [] });
}

export async function resolveClienteRefFromBody(
  body: Record<string, unknown>,
  existing?: IClienteRef | null
): Promise<IClienteRef[]> {
  const lateral = (body.lateralForm ?? {}) as Record<string, unknown>;
  const cpfFromBody = normalizeCpf(body.clientCPF ?? lateral.clienteCpf ?? lateral.cpf);
  const clienteIdRaw = body.clienteId ?? (body.cliente as { clienteId?: unknown }[] | undefined)?.[0]?.clienteId;
  const cpf = cpfFromBody || normalizeCpf(existing?.clienteCpf);

  if (!cpf && !clienteIdRaw && !existing?.clienteId) return [];

  let cliente: ICliente | null = null;

  if (clienteIdRaw && mongoose.Types.ObjectId.isValid(String(clienteIdRaw))) {
    cliente = await findClienteById(clienteIdRaw);
  }

  if (!cliente && cpf) {
    cliente = await findClienteByCpf(cpf);
  }

  const hasContactData =
    body.clientName !== undefined ||
    body.clientCPF !== undefined ||
    lateral.clienteNome !== undefined ||
    lateral.cpf !== undefined;

  if (!cliente && cpf && hasContactData) {
    cliente = await upsertClienteFromBody(body);
  }

  if (!cliente && !cpf) {
    const emailList = normalizeStringList(lateral.clienteEmail);
    for (const item of emailList) {
      cliente = await findClienteByEmail(item);
      if (cliente) break;
    }
  }

  const resolvedCpf = cpf || normalizeCpf(getPrimaryDados(cliente)?.clienteCpf);
  const resolvedId = cliente?._id ?? existing?.clienteId ?? null;

  if (!resolvedCpf && !resolvedId) return [];

  return [
    {
      clienteCpf: resolvedCpf,
      clienteId: resolvedId as mongoose.Types.ObjectId | null,
    },
  ];
}
