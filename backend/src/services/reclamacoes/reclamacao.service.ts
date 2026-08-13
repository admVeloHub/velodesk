/** reclamacao.service v1.0.0 — persistência pós-validação Agente 4 em chamados_reclamacoes */
import { Types, type Model } from 'mongoose';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import type { IReclamacao } from '../../models/reclamacoes/reclamacaoModels';
import {
  getReclamacaoBacenModel,
  getReclamacaoConsumidorGovModel,
  getReclamacaoProconModel,
  getReclamacaoReclameAquiModel,
} from '../../models/reclamacoes/reclamacaoModels';
import { currentStatus, findBacenFromChamado, findConsumidorGovFromChamado, normalizeStatusValue, readTabulacaoSnapshot } from '../chamado.mapper';
import type {
  CasoEspecialOrgao,
  CasoEspecialTriagemPersisted,
} from '../agents/casosEspeciais.types';

const AGENTE_VERSAO = 'casosEspeciaisAgent v1.0.0';

export type ReclamacaoOrgaoRoute =
  | 'reclame-aqui'
  | 'procon'
  | 'bacen'
  | 'consumidor-gov';

const ROUTE_TO_ORGAO: Record<ReclamacaoOrgaoRoute, CasoEspecialOrgao> = {
  'reclame-aqui': 'reclame_aqui',
  procon: 'procon',
  bacen: 'bacen',
  'consumidor-gov': 'consumidor_gov',
};

const ORGAO_TO_ROUTE: Record<Exclude<CasoEspecialOrgao, 'indefinido'>, ReclamacaoOrgaoRoute> = {
  reclame_aqui: 'reclame-aqui',
  procon: 'procon',
  bacen: 'bacen',
  consumidor_gov: 'consumidor-gov',
};

export interface ReclamacaoPersistContext {
  origemEntrada: string;
  inboxDedicada?: boolean;
  emailThreadRootId?: string;
  workflowSlug?: string;
}

export interface ReclamacaoListFilters {
  aberta?: boolean;
  statusCanal?: string;
  limit?: number;
  skip?: number;
}

function registroMetadados(chamado: IChamadoN1): Record<string, unknown> {
  for (const reg of chamado.registro ?? []) {
    if (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados)) {
      return reg.metadados as Record<string, unknown>;
    }
  }
  return {};
}

export function parseReclamacaoOrgaoRoute(raw: string): CasoEspecialOrgao | null {
  const key = String(raw ?? '').trim().toLowerCase() as ReclamacaoOrgaoRoute;
  return ROUTE_TO_ORGAO[key] ?? null;
}

export function orgaoToRoute(orgao: CasoEspecialOrgao): ReclamacaoOrgaoRoute | null {
  if (orgao === 'indefinido') return null;
  return ORGAO_TO_ROUTE[orgao] ?? null;
}

export function resolveReclamacaoModel(orgao: CasoEspecialOrgao): Model<IReclamacao> | null {
  switch (orgao) {
    case 'reclame_aqui':
      return getReclamacaoReclameAquiModel();
    case 'procon':
      return getReclamacaoProconModel();
    case 'bacen':
      return getReclamacaoBacenModel();
    case 'consumidor_gov':
      return getReclamacaoConsumidorGovModel();
    default:
      return null;
  }
}

function readCanalMeta(chamado: IChamadoN1): Record<string, unknown> {
  const tab = readTabulacaoSnapshot(
    chamado.tabulacao?.[chamado.tabulacao.length - 1] ?? chamado.tabulacao?.[0],
  ) as unknown as Record<string, unknown>;
  const procon = tab.procon;
  if (procon && typeof procon === 'object' && !Array.isArray(procon)) {
    return procon as Record<string, unknown>;
  }
  const gov = tab.consumidorGov;
  if (gov && typeof gov === 'object' && !Array.isArray(gov)) {
    return gov as Record<string, unknown>;
  }
  const govFromRegistro = findConsumidorGovFromChamado(chamado);
  if (govFromRegistro) return govFromRegistro;
  const ra = tab.reclameAqui;
  if (ra && typeof ra === 'object' && !Array.isArray(ra)) {
    return ra as Record<string, unknown>;
  }
  const bacen = tab.bacen;
  if (bacen && typeof bacen === 'object' && !Array.isArray(bacen)) {
    return bacen as Record<string, unknown>;
  }
  const bacenFromRegistro = findBacenFromChamado(chamado);
  if (bacenFromRegistro) return bacenFromRegistro;
  return {};
}

function readClientCpf(chamado: IChamadoN1, meta: Record<string, unknown>): string {
  const fromCliente = chamado.cliente?.[0]?.clienteCpf;
  if (fromCliente) return String(fromCliente).trim();
  const tab = readTabulacaoSnapshot(
    chamado.tabulacao?.[chamado.tabulacao.length - 1] ?? chamado.tabulacao?.[0],
  ) as unknown as Record<string, unknown>;
  return String(meta.cpf ?? tab.clienteCpf ?? tab.cpf ?? '').trim();
}

function defaultStatusForOrgao(orgao: CasoEspecialOrgao): string {
  switch (orgao) {
    case 'reclame_aqui':
      return 'nao-respondida';
    case 'procon':
      return 'nao-respondida';
    case 'consumidor_gov':
      return 'nao-respondida';
    case 'bacen':
      return 'nao-respondida';
    default:
      return 'nao-respondida';
  }
}

function buildMetaForOrgao(
  orgao: CasoEspecialOrgao,
  canalMeta: Record<string, unknown>,
): Record<string, unknown> {
  const base = { ...canalMeta };
  if (orgao === 'procon' && canalMeta.statusPc) {
    base.statusPc = canalMeta.statusPc;
  }
  if (orgao === 'consumidor_gov' && canalMeta.statusGov) {
    base.statusGov = canalMeta.statusGov;
  }
  if (orgao === 'reclame_aqui' && canalMeta.statusRa) {
    base.statusRa = canalMeta.statusRa;
    if (canalMeta.passivelNota != null) base.passivelNota = canalMeta.passivelNota;
  }
  if (orgao === 'bacen' && canalMeta.protocoloBacen) {
    base.protocoloBacen = canalMeta.protocoloBacen;
  }
  if (orgao === 'bacen' && canalMeta.statusBc) {
    base.statusBc = canalMeta.statusBc;
  }
  return base;
}

function buildReclamacaoPayload(
  chamado: IChamadoN1,
  orgao: CasoEspecialOrgao,
  triagem: CasoEspecialTriagemPersisted,
  ctx: ReclamacaoPersistContext,
): Partial<IReclamacao> {
  const tab = readTabulacaoSnapshot(
    chamado.tabulacao?.[chamado.tabulacao.length - 1] ?? chamado.tabulacao?.[0],
  );
  const meta = readCanalMeta(chamado);
  const rootMeta = registroMetadados(chamado);
  const status = normalizeStatusKey(currentStatus(chamado));
  const terminal = ['resolvido', 'fechado', 'cancelado'].includes(status);

  const protocoloExterno = String(
    meta.protocoloProcon
    ?? meta.protocoloGov
    ?? meta.protocoloRa
    ?? meta.protocoloBacen
    ?? '',
  ).trim();

  const idDemandaExterna = String(
    meta.idDemanda
    ?? meta.idReclamacaoRa
    ?? meta.idDemandaExterna
    ?? '',
  ).trim();

  return {
    orgao,
    chamadoId: chamado._id as Types.ObjectId,
    chamadoProtocolo: String(chamado.chamadoProtocolo ?? '').trim(),
    origemEntrada: ctx.origemEntrada,
    inboxDedicada: Boolean(ctx.inboxDedicada ?? rootMeta.inboxDedicada),
    emailThreadRootId: String(
      ctx.emailThreadRootId ?? rootMeta.emailThreadRootId ?? '',
    ).trim() || undefined,
    triagem: {
      classificacao: triagem.classificacao,
      orgao: triagem.orgao,
      confianca: triagem.confianca,
      evidencia: triagem.evidencia,
      justificativa: triagem.justificativa,
      signals: triagem.signals ?? [],
      at: triagem.at ? new Date(triagem.at) : new Date(),
      agenteVersao: AGENTE_VERSAO,
    },
    consumidor: String(
      meta.consumidor
      ?? tab.motivo
      ?? (chamado.cliente?.[0] as { clienteNome?: string } | undefined)?.clienteNome
      ?? '',
    ).trim(),
    cpf: readClientCpf(chamado, meta) || undefined,
    email: Array.isArray(meta.email)
      ? (meta.email as string[]).map(String)
      : undefined,
    telefoneWhatsapp: String(meta.telefoneWhatsapp ?? '').trim() || undefined,
    assunto: String(meta.assunto ?? chamado.chamadoTitulo ?? tab.motivo ?? '').trim(),
    descricao: String(
      meta.descricao
      ?? tab.detalhe
      ?? chamado.registro?.[0]?.mensagemPublica
      ?? '',
    ).trim(),
    produto: String(meta.produto ?? tab.produto ?? '').trim() || undefined,
    tipo: String(meta.tipo ?? tab.tipoChamado ?? (tab as { classificacaoTipo?: string }).classificacaoTipo ?? '').trim() || undefined,
    motivo: String(meta.motivo ?? tab.motivo ?? '').trim() || undefined,
    statusCanal: String(
      meta.statusPc
      ?? meta.statusGov
      ?? meta.statusRa
      ?? meta.statusBc
      ?? meta.statusCanal
      ?? defaultStatusForOrgao(orgao),
    ).trim(),
    prazoLegal: meta.prazoLegal
      ? new Date(String(meta.prazoLegal))
      : meta.prazoRa
        ? new Date(String(meta.prazoRa))
        : undefined,
    orgaoInstituicao: String(
      meta.orgaoProcon ?? meta.orgaoGov ?? meta.orgaoInstituicao ?? '',
    ).trim() || undefined,
    cidade: String(meta.cidade ?? '').trim() || undefined,
    uf: String(meta.uf ?? '').trim() || undefined,
    protocoloExterno: protocoloExterno || undefined,
    idDemandaExterna: idDemandaExterna || undefined,
    atendente: String(tab.responsavel ?? '').trim() || undefined,
    responsavel: String(tab.responsavel ?? '').trim() || undefined,
    workflowId: chamado.workflow?.workflowId ?? undefined,
    workflowSlug: ctx.workflowSlug ?? undefined,
    workflowAtivo: Boolean(chamado.workflow?.active),
    aberta: !terminal,
    meta: buildMetaForOrgao(orgao, meta),
  };
}

function normalizeStatusKey(status: unknown): string {
  return normalizeStatusValue(status);
}

export async function upsertFromChamado(
  chamado: IChamadoN1,
  triagem: CasoEspecialTriagemPersisted,
  ctx: ReclamacaoPersistContext,
): Promise<IReclamacao | null> {
  if (triagem.classificacao !== 'caso_formal_real') return null;
  if (!chamado._id) return null;

  const orgao = triagem.orgao;
  if (orgao === 'indefinido') return null;

  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return null;

  const payload = buildReclamacaoPayload(chamado, orgao, triagem, ctx);
  const doc = await Model.findOneAndUpdate(
    { chamadoId: chamado._id },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  return doc;
}

export async function findByChamadoId(
  orgao: CasoEspecialOrgao,
  chamadoId: string | Types.ObjectId,
): Promise<IReclamacao | null> {
  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return null;
  return Model.findOne({ chamadoId: new Types.ObjectId(String(chamadoId)) }).exec();
}

export async function findReclamacaoByChamadoIdAnyOrgao(
  chamadoId: string | Types.ObjectId,
): Promise<IReclamacao | null> {
  const id = new Types.ObjectId(String(chamadoId));
  for (const orgao of ['reclame_aqui', 'procon', 'bacen', 'consumidor_gov'] as const) {
    const doc = await findByChamadoId(orgao, id);
    if (doc) return doc;
  }
  return null;
}

export async function syncFromChamado(chamado: IChamadoN1): Promise<IReclamacao | null> {
  if (!chamado._id) return null;

  const existing = await findReclamacaoByChamadoIdAnyOrgao(chamado._id);
  if (!existing) return null;

  const orgao = existing.orgao as CasoEspecialOrgao;
  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return null;

  const tab = readTabulacaoSnapshot(
    chamado.tabulacao?.[chamado.tabulacao.length - 1] ?? chamado.tabulacao?.[0],
  );
  const meta = readCanalMeta(chamado);
  const status = normalizeStatusKey(currentStatus(chamado));
  const terminal = ['resolvido', 'fechado', 'cancelado'].includes(status);

  const patch: Partial<IReclamacao> = {
    responsavel: String(tab.responsavel ?? existing.responsavel ?? '').trim() || undefined,
    atendente: String(tab.responsavel ?? existing.atendente ?? '').trim() || undefined,
    workflowAtivo: Boolean(chamado.workflow?.active),
    workflowId: chamado.workflow?.workflowId ?? existing.workflowId,
    aberta: !terminal,
    statusCanal: String(
      meta.statusPc
      ?? meta.statusGov
      ?? meta.statusRa
      ?? meta.statusBc
      ?? existing.statusCanal,
    ).trim(),
    meta: buildMetaForOrgao(orgao, { ...(existing.meta as Record<string, unknown>), ...meta }),
  };

  return Model.findOneAndUpdate(
    { chamadoId: chamado._id },
    { $set: patch },
    { new: true },
  ).exec();
}

export async function listByOrgao(
  orgao: CasoEspecialOrgao,
  filters: ReclamacaoListFilters = {},
): Promise<IReclamacao[]> {
  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return [];

  const query: Record<string, unknown> = {};
  if (filters.aberta != null) query.aberta = filters.aberta;
  if (filters.statusCanal) query.statusCanal = filters.statusCanal;

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const skip = Math.max(filters.skip ?? 0, 0);

  return Model.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
}

export async function findByIdOrgao(
  orgao: CasoEspecialOrgao,
  id: string,
): Promise<IReclamacao | null> {
  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return null;

  if (Types.ObjectId.isValid(id)) {
    const byId = await Model.findById(id).exec();
    if (byId) return byId;
    return Model.findOne({ chamadoId: new Types.ObjectId(id) }).exec();
  }

  return Model.findOne({ chamadoProtocolo: id }).exec();
}

export function readInboxDedicadaHint(chamado: IChamadoN1): boolean {
  const meta = registroMetadados(chamado);
  return Boolean(meta.inboxDedicada);
}

export function readCanalProvavelHint(chamado: IChamadoN1): string | null {
  const meta = registroMetadados(chamado);
  const hint = String(meta.canalProvavel ?? '').trim();
  return hint || null;
}

export function reclamacaoToPortalDto(doc: IReclamacao): Record<string, unknown> {
  const meta = (doc.meta && typeof doc.meta === 'object' ? doc.meta : {}) as Record<string, unknown>;
  return {
    id: String(doc._id),
    chamadoId: String(doc.chamadoId),
    ticketId: String(doc.chamadoId),
    chamadoProtocolo: doc.chamadoProtocolo,
    orgao: doc.orgao,
    consumidor: doc.consumidor,
    iniciais: computeIniciais(doc.consumidor),
    cpf: doc.cpf,
    email: doc.email,
    telefoneWhatsapp: doc.telefoneWhatsapp,
    assunto: doc.assunto,
    descricao: doc.descricao,
    produto: doc.produto,
    tipo: doc.tipo,
    motivo: doc.motivo,
    statusCanal: doc.statusCanal,
    statusPc: meta.statusPc ?? (doc.orgao === 'procon' ? doc.statusCanal : undefined),
    statusGov: meta.statusGov ?? (doc.orgao === 'consumidor_gov' ? doc.statusCanal : undefined),
    statusRa: meta.statusRa ?? (doc.orgao === 'reclame_aqui' ? doc.statusCanal : undefined),
    protocoloProcon: doc.orgao === 'procon' ? doc.protocoloExterno : undefined,
    protocoloGov: doc.orgao === 'consumidor_gov' ? doc.protocoloExterno : undefined,
    protocoloRa: doc.orgao === 'reclame_aqui' ? doc.protocoloExterno : undefined,
    protocoloBacen: doc.orgao === 'bacen' ? doc.protocoloExterno : undefined,
    idDemanda: doc.idDemandaExterna,
    prazoLegal: doc.prazoLegal,
    slaPct: doc.slaPct,
    orgaoProcon: doc.orgao === 'procon' ? doc.orgaoInstituicao : undefined,
    orgaoGov: doc.orgao === 'consumidor_gov' ? doc.orgaoInstituicao : undefined,
    cidade: doc.cidade,
    uf: doc.uf,
    atendente: doc.atendente,
    responsavel: doc.responsavel,
    workflowAtivo: doc.workflowAtivo,
    aberta: doc.aberta,
    inboxDedicada: doc.inboxDedicada,
    triagem: doc.triagem,
    meta,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function computeIniciais(name: string): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export async function patchReclamacao(
  orgao: CasoEspecialOrgao,
  id: string,
  patch: Record<string, unknown>,
): Promise<IReclamacao | null> {
  const doc = await findByIdOrgao(orgao, id);
  if (!doc) return null;

  const Model = resolveReclamacaoModel(orgao);
  if (!Model) return null;

  const allowed: Partial<IReclamacao> = {};
  const scalarFields = [
    'statusCanal', 'prazoLegal', 'atendente', 'responsavel', 'aberta',
    'protocoloExterno', 'idDemandaExterna', 'slaPct',
  ] as const;

  for (const key of scalarFields) {
    if (patch[key] !== undefined) {
      (allowed as Record<string, unknown>)[key] = patch[key];
    }
  }

  if (patch.meta && typeof patch.meta === 'object') {
    allowed.meta = {
      ...(doc.meta as Record<string, unknown>),
      ...(patch.meta as Record<string, unknown>),
    };
  }

  return Model.findByIdAndUpdate(doc._id, { $set: allowed }, { new: true }).exec();
}
