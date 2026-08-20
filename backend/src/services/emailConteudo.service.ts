/** emailConteudo.service v1.0.0 — CRUD desk_config.email_conteudos */
import { Types } from 'mongoose';
import { EMAIL_CRITERIO_TIPOS, getEmailConteudoModel, type IEmailCriterio } from '../models/EmailConteudo';
import { EMAIL_CONTEUDO_SEED } from './emailOutbound.constants';

export function serializeEmailConteudo(doc: {
  _id: Types.ObjectId;
  nome: string;
  ativo: boolean;
  saudacao: string;
  corpo: string;
  gatilho?: { criterios?: IEmailCriterio[] };
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(doc._id),
    nome: doc.nome,
    ativo: Boolean(doc.ativo),
    saudacao: doc.saudacao || '',
    corpo: doc.corpo || '',
    gatilho: {
      criterios: (doc.gatilho?.criterios || []).map((item) => ({
        tipo: item.tipo,
        valores: Array.isArray(item.valores) ? item.valores.map((value) => String(value)) : [],
      })),
    },
    updatedBy: doc.updatedBy || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function sanitizeCriterios(raw: unknown): IEmailCriterio[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: IEmailCriterio[] = [];
  for (const item of raw) {
    const tipo = String((item as { tipo?: string })?.tipo || '').trim() as IEmailCriterio['tipo'];
    if (!EMAIL_CRITERIO_TIPOS.includes(tipo) || seen.has(tipo)) continue;
    seen.add(tipo);
    const valores = Array.isArray((item as { valores?: unknown })?.valores)
      ? (item as { valores: unknown[] }).valores.map((value) => String(value ?? '').trim()).filter(Boolean)
      : [];
    list.push({ tipo, valores: tipo === 'gatilho_interno' ? [] : valores });
  }
  if (list.some((item) => item.tipo === 'gatilho_interno')) {
    return [{ tipo: 'gatilho_interno', valores: [] }];
  }
  return list;
}

export async function seedEmailConteudosIfEmpty(): Promise<void> {
  const Model = getEmailConteudoModel();
  const count = await Model.countDocuments();
  if (count > 0) return;
  await Model.insertMany(
    EMAIL_CONTEUDO_SEED.map((item) => ({
      nome: item.nome,
      ativo: item.ativo,
      saudacao: item.saudacao,
      corpo: item.corpo,
      gatilho: item.gatilho,
      updatedBy: 'seed',
    })),
  );
  console.info(`[emailConteudo] seed — ${EMAIL_CONTEUDO_SEED.length} e-mail(s) de saída`);
}

export async function listEmailConteudos() {
  const Model = getEmailConteudoModel();
  const docs = await Model.find({}).sort({ nome: 1 }).lean().exec();
  return docs.map(serializeEmailConteudo);
}

export async function getEmailConteudoById(id: string) {
  const Model = getEmailConteudoModel();
  const doc = await Model.findById(id).lean().exec();
  return doc ? serializeEmailConteudo(doc) : null;
}

export async function createEmailConteudo(payload: {
  nome?: string;
  ativo?: boolean;
  saudacao?: string;
  corpo?: string;
  gatilho?: { criterios?: unknown };
}, actor: string) {
  const nome = String(payload.nome || '').trim();
  if (!nome) throw new Error('Informe o nome do e-mail.');
  const Model = getEmailConteudoModel();
  const doc = await Model.create({
    nome,
    ativo: payload.ativo !== false,
    saudacao: String(payload.saudacao || ''),
    corpo: String(payload.corpo || ''),
    gatilho: { criterios: sanitizeCriterios(payload.gatilho?.criterios) },
    updatedBy: actor,
  });
  return serializeEmailConteudo(doc);
}

export async function updateEmailConteudo(id: string, payload: {
  nome?: string;
  ativo?: boolean;
  saudacao?: string;
  corpo?: string;
  gatilho?: { criterios?: unknown };
}, actor: string) {
  const Model = getEmailConteudoModel();
  const $set: Record<string, unknown> = { updatedBy: actor };
  if (payload.nome !== undefined) {
    const nome = String(payload.nome || '').trim();
    if (!nome) throw new Error('Informe o nome do e-mail.');
    $set.nome = nome;
  }
  if (payload.ativo !== undefined) $set.ativo = Boolean(payload.ativo);
  if (payload.saudacao !== undefined) $set.saudacao = String(payload.saudacao || '');
  if (payload.corpo !== undefined) $set.corpo = String(payload.corpo || '');
  if (payload.gatilho !== undefined) {
    $set.gatilho = { criterios: sanitizeCriterios(payload.gatilho?.criterios) };
  }
  const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true }).lean().exec();
  return doc ? serializeEmailConteudo(doc) : null;
}

export async function deleteEmailConteudo(id: string) {
  const Model = getEmailConteudoModel();
  const result = await Model.deleteOne({ _id: id }).exec();
  return result.deletedCount === 1;
}

export async function listActiveEmailConteudos() {
  const Model = getEmailConteudoModel();
  return Model.find({ ativo: true }).lean().exec();
}
