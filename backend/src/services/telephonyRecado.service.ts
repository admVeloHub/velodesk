/** telephonyRecado.service v2.0.0 — CRUD e publicação v2 de recados operacionais */
import mongoose from 'mongoose';
import {
  compareRecadoPrioridade,
  ITelephonyRecado,
  TelephonyRecado,
} from '../models/TelephonyRecado';
import {
  RECADO_LIMITS,
  RECADOS_SCHEMA_VERSION,
  TelephonyRecadoPrioridade,
} from './telephonyRecado.constants';
import {
  generateRecadoId,
  RecadoInputPayload,
  validateRecadoInput,
  ValidatedRecadoInput,
} from './telephonyRecado.validation';

export interface TelephonyRecadoDto {
  id: string;
  recadoId: string;
  titulo: string;
  areas: string[];
  tipo: string;
  mensagemCliente: string;
  orientacaoAtendimento: string;
  politicaChamado: string;
  criterioChamado: string | null;
  telefonesOrigemLiberados: string[] | null;
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
  areas: string[];
  tipo: string;
  mensagemCliente: string;
  orientacaoAtendimento: string;
  politicaChamado: string;
  criterioChamado: string | null;
  prioridade: TelephonyRecadoPrioridade;
  telefonesOrigemLiberados: string[] | null;
  updatedAt: string;
}

export interface TelephonyRecadosPartnerEnvelope {
  schemaVersion: typeof RECADOS_SCHEMA_VERSION;
  updatedAt: string;
  items: TelephonyRecadoPartnerItem[];
}

function resolveLegacyFields(doc: ITelephonyRecado): ValidatedRecadoInput {
  const mensagemCliente = String(doc.mensagemCliente ?? doc.mensagem ?? '').trim();
  const orientacaoAtendimento = String(doc.orientacaoAtendimento ?? '').trim()
    || (doc.mensagem?.trim()
      ? 'Recado migrado da versão anterior — revise a orientação específica de aplicação.'
      : '');
  const areas = Array.isArray(doc.areas) && doc.areas.length > 0 ? doc.areas : ['geral'];
  const politicaChamado = doc.politicaChamado ?? 'fluxo_normal';
  const criterioChamado = politicaChamado === 'abrir_se_persistir'
    ? String(doc.criterioChamado ?? '').trim() || null
    : null;

  return {
    titulo: String(doc.titulo ?? '').trim(),
    areas: areas as ValidatedRecadoInput['areas'],
    tipo: doc.tipo ?? 'aviso',
    mensagemCliente,
    orientacaoAtendimento,
    politicaChamado,
    criterioChamado,
    prioridade: doc.prioridade ?? 'media',
    telefonesOrigemLiberados: doc.telefonesOrigemLiberados ?? null,
    ativo: doc.ativo !== false,
  };
}

function isPublishableRecado(resolved: ValidatedRecadoInput): boolean {
  if (!resolved.titulo || !resolved.mensagemCliente || !resolved.orientacaoAtendimento) return false;
  if (!resolved.areas.length) return false;
  if (resolved.politicaChamado === 'abrir_se_persistir' && !resolved.criterioChamado) return false;
  return true;
}

function toPartnerItem(doc: ITelephonyRecado): TelephonyRecadoPartnerItem | null {
  const resolved = resolveLegacyFields(doc);
  if (!isPublishableRecado(resolved)) return null;
  const recadoId = String(doc.recadoId ?? doc._id);
  return {
    id: recadoId,
    titulo: resolved.titulo,
    areas: [...resolved.areas],
    tipo: resolved.tipo,
    mensagemCliente: resolved.mensagemCliente,
    orientacaoAtendimento: resolved.orientacaoAtendimento,
    politicaChamado: resolved.politicaChamado,
    criterioChamado: resolved.criterioChamado,
    prioridade: resolved.prioridade,
    telefonesOrigemLiberados: resolved.telefonesOrigemLiberados,
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function toDto(doc: ITelephonyRecado): TelephonyRecadoDto {
  const resolved = resolveLegacyFields(doc);
  return {
    id: String(doc._id),
    recadoId: String(doc.recadoId ?? doc._id),
    titulo: resolved.titulo,
    areas: [...resolved.areas],
    tipo: resolved.tipo,
    mensagemCliente: resolved.mensagemCliente,
    orientacaoAtendimento: resolved.orientacaoAtendimento,
    politicaChamado: resolved.politicaChamado,
    criterioChamado: resolved.criterioChamado,
    telefonesOrigemLiberados: resolved.telefonesOrigemLiberados,
    prioridade: resolved.prioridade,
    ativo: doc.ativo !== false,
    criadoPor: doc.criadoPor,
    atualizadoPor: doc.atualizadoPor,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function sortPartnerItems(a: TelephonyRecadoPartnerItem, b: TelephonyRecadoPartnerItem): number {
  const byPriority = compareRecadoPrioridade(a.prioridade, b.prioridade);
  if (byPriority !== 0) return byPriority;
  const byUpdated = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (byUpdated !== 0) return byUpdated;
  return a.id.localeCompare(b.id);
}

async function assertActiveLimit(willBeActive: boolean, excludeId?: string): Promise<void> {
  if (!willBeActive) return;
  const filter: Record<string, unknown> = { ativo: true };
  if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
    filter._id = { $ne: excludeId };
  }
  const count = await TelephonyRecado.countDocuments(filter);
  if (count >= RECADO_LIMITS.maxActiveItems) {
    throw new Error(`Limite de ${RECADO_LIMITS.maxActiveItems} recados ativos atingido`);
  }
}

export async function listAllRecados(): Promise<TelephonyRecadoDto[]> {
  const rows = await TelephonyRecado.find().sort({ ativo: -1, updatedAt: -1 }).lean();
  return rows.map((row) => toDto(row as unknown as ITelephonyRecado));
}

export async function buildPartnerRecadosEnvelope(): Promise<TelephonyRecadosPartnerEnvelope> {
  const rows = await TelephonyRecado.find({ ativo: true }).lean();
  const items = rows
    .map((row) => toPartnerItem(row as unknown as ITelephonyRecado))
    .filter((item): item is TelephonyRecadoPartnerItem => Boolean(item))
    .sort(sortPartnerItems);

  const envelopeUpdatedAt = await getRecadosEnvelopeUpdatedAt();
  return {
    schemaVersion: RECADOS_SCHEMA_VERSION,
    updatedAt: envelopeUpdatedAt,
    items,
  };
}

export async function listActiveRecadosForPartner(): Promise<TelephonyRecadoPartnerItem[]> {
  const envelope = await buildPartnerRecadosEnvelope();
  return envelope.items;
}

export async function createRecado(
  input: RecadoInputPayload,
  userId?: string,
): Promise<TelephonyRecadoDto> {
  const validated = validateRecadoInput(input);
  await assertActiveLimit(validated.ativo);
  const recadoId = generateRecadoId(validated.titulo);
  const doc = await TelephonyRecado.create({
    recadoId,
    ...validated,
    criadoPor: userId,
    atualizadoPor: userId,
  });
  return toDto(doc);
}

export async function updateRecado(
  id: string,
  input: RecadoInputPayload,
  userId?: string,
): Promise<TelephonyRecadoDto | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const existing = await TelephonyRecado.findById(id);
  if (!existing) return null;

  const current = resolveLegacyFields(existing);
  const merged: RecadoInputPayload = {
    titulo: input.titulo ?? current.titulo,
    areas: input.areas ?? current.areas,
    tipo: input.tipo ?? current.tipo,
    mensagemCliente: input.mensagemCliente ?? current.mensagemCliente,
    orientacaoAtendimento: input.orientacaoAtendimento ?? current.orientacaoAtendimento,
    politicaChamado: input.politicaChamado ?? current.politicaChamado,
    criterioChamado: input.criterioChamado !== undefined ? input.criterioChamado : current.criterioChamado,
    prioridade: input.prioridade ?? current.prioridade,
    telefonesOrigemLiberados: input.telefonesOrigemLiberados !== undefined
      ? input.telefonesOrigemLiberados
      : current.telefonesOrigemLiberados,
    ativo: input.ativo !== undefined ? input.ativo : current.ativo,
  };

  const validated = validateRecadoInput(merged);
  await assertActiveLimit(validated.ativo, id);

  existing.titulo = validated.titulo;
  existing.areas = validated.areas;
  existing.tipo = validated.tipo;
  existing.mensagemCliente = validated.mensagemCliente;
  existing.orientacaoAtendimento = validated.orientacaoAtendimento;
  existing.politicaChamado = validated.politicaChamado;
  existing.criterioChamado = validated.criterioChamado;
  existing.prioridade = validated.prioridade;
  existing.telefonesOrigemLiberados = validated.telefonesOrigemLiberados;
  existing.ativo = validated.ativo;
  existing.atualizadoPor = userId;
  if (!existing.recadoId) {
    existing.recadoId = generateRecadoId(validated.titulo);
  }
  await existing.save();
  return toDto(existing);
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
  const row = await TelephonyRecado.findOne({ ativo: true })
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  return row?.updatedAt ? new Date(row.updatedAt).toISOString() : null;
}

export async function getRecadosEnvelopeUpdatedAt(): Promise<string> {
  const row = await TelephonyRecado.findOne()
    .sort({ updatedAt: -1 })
    .select('updatedAt')
    .lean();
  return row?.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString();
}

/** Garante recadoId e campos v2 mínimos em registros legados v1 */
export async function migrateLegacyRecadosIfNeeded(): Promise<number> {
  const legacy = await TelephonyRecado.find({
    $or: [
      { recadoId: { $exists: false } },
      { recadoId: '' },
      { mensagemCliente: { $in: [null, ''] }, mensagem: { $exists: true, $ne: '' } },
    ],
  });

  let migrated = 0;
  for (const doc of legacy) {
    if (!doc.recadoId) {
      doc.recadoId = generateRecadoId(doc.titulo || 'recado');
    }
    if (!doc.mensagemCliente?.trim() && doc.mensagem?.trim()) {
      doc.mensagemCliente = doc.mensagem.trim();
    }
    if (!doc.orientacaoAtendimento?.trim()) {
      doc.orientacaoAtendimento = doc.mensagem?.trim()
        ? 'Recado migrado da versão anterior — revise a orientação específica de aplicação.'
        : 'Informe quando este recado deve ser aplicado.';
    }
    if (!Array.isArray(doc.areas) || doc.areas.length === 0) {
      doc.areas = ['geral'];
    }
    if (!doc.tipo) doc.tipo = 'aviso';
    if (!doc.politicaChamado) doc.politicaChamado = 'fluxo_normal';
    if (doc.politicaChamado !== 'abrir_se_persistir') {
      doc.criterioChamado = null;
    }
    if (doc.telefonesOrigemLiberados === undefined) {
      doc.telefonesOrigemLiberados = null;
    }
    await doc.save();
    migrated += 1;
  }
  return migrated;
}

export { RECADOS_SCHEMA_VERSION };
