/** telephonyRecado.service v1.0.0 — CRUD de recados emergenciais */
import mongoose from 'mongoose';
import {
  compareRecadoPrioridade,
  ITelephonyRecado,
  TelephonyRecado,
  TelephonyRecadoPrioridade,
} from '../models/TelephonyRecado';

export interface TelephonyRecadoDto {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: TelephonyRecadoPrioridade;
  ativo: boolean;
  criadoPor?: string;
  atualizadoPor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelephonyRecadoPartnerItem {
  id: string;
  titulo: string;
  mensagem: string;
  prioridade: TelephonyRecadoPrioridade;
  updatedAt: Date;
}

function toDto(doc: ITelephonyRecado): TelephonyRecadoDto {
  return {
    id: String(doc._id),
    titulo: doc.titulo,
    mensagem: doc.mensagem,
    prioridade: doc.prioridade,
    ativo: doc.ativo,
    criadoPor: doc.criadoPor,
    atualizadoPor: doc.atualizadoPor,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizePrioridade(value: unknown): TelephonyRecadoPrioridade {
  const raw = String(value ?? 'media').trim().toLowerCase();
  if (raw === 'alta' || raw === 'high') return 'alta';
  if (raw === 'baixa' || raw === 'low') return 'baixa';
  return 'media';
}

export async function listAllRecados(): Promise<TelephonyRecadoDto[]> {
  const rows = await TelephonyRecado.find().sort({ ativo: -1, updatedAt: -1 }).lean();
  return rows.map((row) => toDto(row as unknown as ITelephonyRecado));
}

export async function listActiveRecadosForPartner(): Promise<TelephonyRecadoPartnerItem[]> {
  const rows = await TelephonyRecado.find({ ativo: true }).lean();
  return rows
    .map((row) => {
      const doc = row as unknown as ITelephonyRecado;
      return {
        id: String(doc._id),
        titulo: doc.titulo,
        mensagem: doc.mensagem,
        prioridade: doc.prioridade,
        updatedAt: new Date(doc.updatedAt),
      };
    })
    .sort((a, b) => compareRecadoPrioridade(a.prioridade, b.prioridade));
}

export async function createRecado(
  input: { titulo: string; mensagem: string; prioridade?: string; ativo?: boolean },
  userId?: string,
): Promise<TelephonyRecadoDto> {
  const titulo = String(input.titulo ?? '').trim();
  const mensagem = String(input.mensagem ?? '').trim();
  if (!titulo || !mensagem) throw new Error('Título e mensagem são obrigatórios');
  const doc = await TelephonyRecado.create({
    titulo,
    mensagem,
    prioridade: normalizePrioridade(input.prioridade),
    ativo: input.ativo !== false,
    criadoPor: userId,
    atualizadoPor: userId,
  });
  return toDto(doc);
}

export async function updateRecado(
  id: string,
  input: Partial<{ titulo: string; mensagem: string; prioridade: string; ativo: boolean }>,
  userId?: string,
): Promise<TelephonyRecadoDto | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const update: Record<string, unknown> = { atualizadoPor: userId };
  if (input.titulo !== undefined) update.titulo = String(input.titulo).trim();
  if (input.mensagem !== undefined) update.mensagem = String(input.mensagem).trim();
  if (input.prioridade !== undefined) update.prioridade = normalizePrioridade(input.prioridade);
  if (input.ativo !== undefined) update.ativo = Boolean(input.ativo);
  const doc = await TelephonyRecado.findByIdAndUpdate(id, update, { new: true });
  return doc ? toDto(doc) : null;
}

export async function deleteRecado(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const result = await TelephonyRecado.findByIdAndDelete(id);
  return Boolean(result);
}

export async function countActiveRecados(): Promise<number> {
  return TelephonyRecado.countDocuments({ ativo: true });
}

export async function getLatestActiveRecadoUpdatedAt(): Promise<string | null> {
  const row = await TelephonyRecado.findOne({ ativo: true }).sort({ updatedAt: -1 }).select('updatedAt').lean();
  return row?.updatedAt ? new Date(row.updatedAt).toISOString() : null;
}
