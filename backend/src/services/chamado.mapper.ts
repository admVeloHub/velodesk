/** chamado.mapper v2.9.4 — workflow não ativa em PUT/commit; só POST /workflow/start */
import mongoose from 'mongoose';
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1, IRegistro, ITabulacao, IClienteRef } from '../models/ChamadoN1';
import {
  batchLoadDadosForRefs,
  loadDadosForRef,
  normalizeCpf,
  resolveClienteRefFromBody,
  resolveDadosFromBatch,
  type ClienteDadosBatchContext,
} from './cliente.service';
import { allocateNextProtocolo } from './protocolo.service';
import type { IClienteDados } from '../models/Cliente';
import type { IWorkflowDefinicao } from '../models/WorkflowDefinicao';
import { assertTabulacaoForStatus } from './tabulation.service';
import { buildLateralWorkflowDto, loadWorkflowDefForChamado } from './workflowDto.util';
import { getWorkflowsByIds } from './workflowDefinicao.service';
import { extractEmailReplyContent } from './emailReplyContent.util';
import { sanitizeResponsavel, inferResponsavelFromAgentRegistro } from './responsavel.util';
import { decodeBasicHtmlEntities } from './emailHtml.util';
import { filterRealAttachmentUrls } from './attachmentFilter.util';
import { excludeFusaoAbsorvidosFilter, serializeFusaoDto } from './ticketFusao.helpers';
import {
  readWhatsAppMensagens,
  WHATSAPP_THREAD_SOURCE,
} from './twilio/whatsappThread.service';

function normalizeTicketMessageText(raw: string): string {
  return decodeBasicHtmlEntities(String(raw ?? '').trim());
}

export type RegistroOrigin = 'agente' | 'cliente';

export interface TicketMessageDto {
  id?: string;
  text: string;
  sender: string;
  origin?: RegistroOrigin;
  author?: string;
  registroIndex?: number;
  type?: string;
  channel?: string;
  time: Date;
  attachments?: string[];
}

const TABULACAO_TRACKED_FIELDS: (keyof ITabulacao)[] = [
  'tipoChamado',
  'produto',
  'motivo',
  'detalhe',
  'responsavel',
  'atribuido',
];

function legacyAlteracoesObject(reg: IRegistro): Record<string, unknown> | null {
  const alt = reg.alteracoes as unknown;
  if (alt && !Array.isArray(alt) && typeof alt === 'object') {
    return alt as Record<string, unknown>;
  }
  return null;
}

function registroMetadados(reg: IRegistro): Record<string, unknown> {
  if (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados)) {
    return reg.metadados;
  }
  const legacy = legacyAlteracoesObject(reg);
  if (legacy && (legacy.emailMessageId || legacy.source === 'email-inbound')) {
    return legacy;
  }
  return {};
}

function readProconFromBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const lf = (body.lateralForm ?? {}) as Record<string, unknown>;
  const pc = lf.procon;
  if (pc && typeof pc === 'object' && !Array.isArray(pc)) {
    return pc as Record<string, unknown>;
  }
  return null;
}

function findProconFromChamado(chamado: IChamadoN1): Record<string, unknown> | null {
  for (const reg of chamado.registro ?? []) {
    const meta = registroMetadados(reg);
    if (String(meta.source ?? '').toLowerCase() === 'procon') {
      const nested = meta.procon;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested as Record<string, unknown>;
      }
      return meta;
    }
  }
  return null;
}

function normalizeCanalValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isProconCanalFromBody(body: Record<string, unknown>): boolean {
  if (readProconFromBody(body)) return true;
  const lf = (body.lateralForm ?? {}) as Record<string, unknown>;
  if (normalizeCanalValue(lf.canal).includes('procon')) return true;
  const channel = normalizeCanalValue(body.channel ?? body.source);
  return channel === 'procon';
}

export function isProconChamado(chamado: IChamadoN1): boolean {
  return Boolean(findProconFromChamado(chamado));
}

function buildMinimalProconMeta(
  chamado: IChamadoN1,
  body?: Record<string, unknown>,
): Record<string, unknown> {
  const lf = (body?.lateralForm ?? {}) as Record<string, unknown>;
  const existing = readProconFromBody(body ?? {}) || findProconFromChamado(chamado);
  if (existing) return existing;
  const tab = readTabulacaoSnapshot(chamado.tabulacao?.[0]);
  return {
    protocoloProcon: String(chamado.chamadoProtocolo ?? '').trim() || undefined,
    consumidor: String(body?.clientName ?? tab.motivo ?? chamado.chamadoTitulo ?? '').trim(),
    assunto: String(chamado.chamadoTitulo ?? body?.title ?? '').trim(),
    descricao: String(body?.text ?? body?.description ?? '').trim(),
    cpf: String(lf.cpf ?? lf.clienteCpf ?? body?.clientCPF ?? '').trim(),
    produto: tab.produto,
    tipo: tab.tipoChamado,
    motivo: tab.motivo,
    statusPc: 'nao-respondida',
  };
}

function ensureProconChannelStamp(
  chamado: IChamadoN1,
  body?: Record<string, unknown>,
  status = 'novo',
): void {
  if (findProconFromChamado(chamado)) return;
  if (body && !isProconCanalFromBody(body)) return;

  const pcMeta = buildMinimalProconMeta(chamado, body);
  const metadados: Record<string, unknown> = { source: 'procon', procon: pcMeta };
  const registro = chamado.registro ?? [];
  const targetStatus = currentStatus(chamado) || status;
  const clienteIdx = registro.findIndex((reg) => String(reg.origin ?? '').toLowerCase() === 'cliente');

  if (clienteIdx >= 0) {
    const reg = registro[clienteIdx];
    const existingMeta = registroMetadados(reg);
    if (String(existingMeta.source ?? '').toLowerCase() !== 'procon') {
      reg.metadados = { ...existingMeta, ...metadados };
    }
    return;
  }

  registro.unshift({
    data: new Date(),
    origin: 'cliente',
    autor: String(body?.clientName ?? chamado.chamadoTitulo ?? 'Consumidor').trim() || 'Consumidor',
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: '',
    anexosAnotacaoInterna: [],
    alteracoes: [],
    metadados,
    status: targetStatus,
  });
  chamado.registro = registro;
}

function readReclameAquiFromBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const lf = (body.lateralForm ?? {}) as Record<string, unknown>;
  const ra = lf.reclameAqui;
  if (ra && typeof ra === 'object' && !Array.isArray(ra)) {
    return ra as Record<string, unknown>;
  }
  return null;
}

function findReclameAquiFromChamado(chamado: IChamadoN1): Record<string, unknown> | null {
  for (const reg of chamado.registro ?? []) {
    const meta = registroMetadados(reg);
    if (String(meta.source ?? '').toLowerCase() === 'reclame-aqui') {
      const nested = meta.reclameAqui;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested as Record<string, unknown>;
      }
      return meta;
    }
  }
  return null;
}

/** Não reidrata lateralForm.workflow de histórico — evita bloquear novo start após interrupção. */
function findLatestWorkflowFromRegistro(_chamado: IChamadoN1): Record<string, unknown> | null {
  return null;
}

function findLatestApprovalFromRegistro(chamado: IChamadoN1): Record<string, unknown> | null {
  const registros = chamado.registro ?? [];
  for (let i = registros.length - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(registros[i]);
    const approval = meta.approval;
    if (approval && typeof approval === 'object' && !Array.isArray(approval)) {
      return approval as Record<string, unknown>;
    }
  }
  return null;
}

export function resolveRegistroOrigin(reg: IRegistro): RegistroOrigin {
  const stored = String(reg.origin ?? '').trim().toLowerCase();
  if (stored === 'agente' || stored === 'cliente') return stored;

  const meta = registroMetadados(reg);
  if (String(meta.source ?? '').toLowerCase() === 'email-inbound') return 'cliente';
  if (String(meta.source ?? '').toLowerCase() === 'reclame-aqui') return 'cliente';
  if (String(meta.source ?? '').toLowerCase() === 'procon') return 'cliente';

  const legacy = legacyAlteracoesObject(reg);
  if (legacy) {
    const sender = String(legacy.sender ?? '').toLowerCase();
    if (sender === 'them') return 'cliente';
    if (sender === 'me') return 'agente';
    if (String(legacy.source ?? '').toLowerCase() === 'email-inbound') return 'cliente';
  }

  if (reg.anotacaoInterna && !reg.mensagemPublica) return 'agente';
  return 'cliente';
}

function diffTabulacao(before: ITabulacao, after: ITabulacao): Record<string, unknown> {
  const change: Record<string, unknown> = {};
  TABULACAO_TRACKED_FIELDS.forEach((key) => {
    const prev = String(before[key] ?? '').trim();
    const next = String(after[key] ?? '').trim();
    if (prev !== next) change[key] = next;
  });
  return change;
}

export function readTabulacaoSnapshot(tab?: ITabulacao | null): ITabulacao {
  if (!tab) {
    return {
      tipoChamado: '',
      produto: '',
      motivo: '',
      detalhe: '',
      responsavel: '',
      atribuido: '',
    };
  }

  const maybeSubdoc = tab as ITabulacao & { toObject?: () => ITabulacao };
  const plain = typeof maybeSubdoc.toObject === 'function'
    ? maybeSubdoc.toObject()
    : tab;

  return {
    tipoChamado: String(plain.tipoChamado ?? '').trim(),
    produto: String(plain.produto ?? '').trim(),
    motivo: String(plain.motivo ?? '').trim(),
    detalhe: String(plain.detalhe ?? '').trim(),
    responsavel: String(plain.responsavel ?? '').trim(),
    atribuido: String(plain.atribuido ?? '').trim(),
  };
}

function buildAlteracoesItem(changes: Record<string, unknown>): unknown[] {
  return Object.keys(changes).length ? [changes] : [];
}

function normalizeAlteracoesArray(alt: unknown): unknown[] {
  if (Array.isArray(alt)) {
    return alt.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  }
  if (alt && typeof alt === 'object') return [alt];
  return [];
}

function isLegacyTechnicalAlteracao(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
  const row = item as Record<string, unknown>;
  if (row.emailMessageId || String(row.source ?? '').toLowerCase() === 'email-inbound') return true;
  if (row.sender) return true;
  return false;
}

function businessAlteracoesFromRegistro(reg: IRegistro): unknown[] {
  return normalizeAlteracoesArray(reg.alteracoes).filter((item) => !isLegacyTechnicalAlteracao(item));
}

function originFromSender(sender: string): RegistroOrigin {
  return sender === 'them' ? 'cliente' : 'agente';
}

function senderFromOrigin(origin: RegistroOrigin): string {
  return origin === 'cliente' ? 'them' : 'me';
}

function isGenericRegistroAutor(value: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'agente' || normalized === 'agent';
}

export function resolveRegistroAutor(
  origin: RegistroOrigin,
  options: {
    authUser?: AuthPayload | null;
    authorHint?: string;
    clientName?: string;
  } = {}
): string {
  if (origin === 'cliente') {
    return String(options.clientName ?? options.authorHint ?? '').trim() || 'Cliente';
  }

  for (const candidate of [
    options.authorHint,
    options.authUser?.name,
    options.authUser?.email,
  ]) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }

  return '';
}

function resolveStoredRegistroAutor(
  reg: IRegistro,
  origin: RegistroOrigin,
  clientName?: string
): string {
  const stored = String(reg.autor ?? '').trim();
  if (stored && !isGenericRegistroAutor(stored)) return stored;
  return resolveRegistroAutor(origin, { clientName });
}

export interface RegistroHistoricoDto {
  id: string;
  registroIndex: number;
  time: Date;
  origin: RegistroOrigin;
  autor: string;
  alteracoes: unknown[];
  status: string;
  anotacaoInterna?: string;
}

export interface TicketDto {
  _id: string;
  chamadoProtocolo: string;
  chamadoTitulo: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  channel?: string;
  source?: string;
  boxId?: string;
  clientName?: string;
  clientCPF?: string;
  responsibleAgent?: string;
  formData?: Record<string, unknown>;
  lateralForm?: Record<string, unknown>;
  workflow?: {
    active?: boolean;
    workflowId?: string | null;
    step?: number;
    passoId?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    pendingDecision?: Record<string, unknown> | string | null;
    requisicao?: {
      preenchidaEm?: Date;
      preenchidaPor?: string;
      valores?: Record<string, unknown>;
      comunicacaoWorkflow?: Array<{ mensagem: string; data: Date; autor: string }>;
      comunicacaoPendente?: boolean;
    };
  };
  messages?: TicketMessageDto[];
  internalNotes?: TicketMessageDto[];
  registroHistorico?: RegistroHistoricoDto[];
  openedBy?: string;
  isDemo?: boolean;
  slaBreached?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  listOnly?: boolean;
  queueEntryAt?: Date;
  fusao?: {
    fundido: boolean;
    dataFundido?: Date | null;
    hierarquia?: string;
    parentId?: string | null;
    childId?: string | null;
    parentProtocolo?: string;
    childProtocolo?: string;
    childProtocolos?: string[];
    childIds?: string[];
  };
}

/** Limites por box na listagem GET /boxes */
export const BOX_LIST_DEFAULT_LIMIT = 250;
export const BOX_LIST_RESOLVED_LIMIT = 150;
export const BOX_LIST_RESOLVED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const TERMINAL_BOX_STATUSES = new Set(['resolvido', 'cancelado', 'fechado']);

export interface ChamadoMapContext {
  mode: 'list' | 'full';
  clienteBatch: ClienteDadosBatchContext;
  workflowById: Map<string, IWorkflowDefinicao>;
}

export interface BoxListFindOptions {
  filter: Record<string, unknown>;
  limit: number;
  sort: { updatedAt: -1 };
}

export async function buildChamadoMapContext(
  chamados: IChamadoN1[],
  mode: 'list' | 'full' = 'list',
): Promise<ChamadoMapContext> {
  const refs = chamados.map((chamado) => chamado.cliente?.[0] as LegacyClienteEmbed | undefined);
  const clienteBatch = await batchLoadDadosForRefs(refs);

  const workflowIds = chamados
    .filter((chamado) => chamado.workflow?.active && chamado.workflow.workflowId)
    .map((chamado) => String(chamado.workflow!.workflowId));

  const workflowById = mode === 'list'
    ? await getWorkflowsByIds(workflowIds)
    : new Map<string, IWorkflowDefinicao>();

  return { mode, clienteBatch, workflowById };
}

export function buildBoxListFindOptions(
  status: string,
  queue?: string,
  responsavelCandidates?: string[],
  extraFilter?: Record<string, unknown>,
): BoxListFindOptions {
  const baseFilter = buildChamadoQueryFilter(status, queue, responsavelCandidates, extraFilter);
  const isTerminal = TERMINAL_BOX_STATUSES.has(status);
  const excludeAbsorvidos = excludeFusaoAbsorvidosFilter();

  let filter: Record<string, unknown> = { $and: [baseFilter, excludeAbsorvidos] };
  if (isTerminal) {
    const since = new Date(Date.now() - BOX_LIST_RESOLVED_MAX_AGE_MS);
    filter = { $and: [baseFilter, excludeAbsorvidos, { updatedAt: { $gte: since } }] };
  }

  return {
    filter,
    limit: isTerminal ? BOX_LIST_RESOLVED_LIMIT : BOX_LIST_DEFAULT_LIMIT,
    sort: { updatedAt: -1 },
  };
}

export async function chamadosToTickets(
  chamados: IChamadoN1[],
  boxId: string,
  mode: 'list' | 'full' = 'full',
): Promise<TicketDto[]> {
  if (!chamados.length) return [];
  if (mode === 'full') {
    return Promise.all(chamados.map((chamado) => chamadoToTicket(chamado, boxId)));
  }

  const ctx = await buildChamadoMapContext(chamados, 'list');
  return chamados.map((chamado) => chamadoToTicketListItem(chamado, boxId, ctx));
}

function buildLateralWorkflowListDto(
  chamado: IChamadoN1,
  definicao: IWorkflowDefinicao,
): Record<string, unknown> {
  // Mesmo payload do detalhe (passosResumo + stepHistory) — stepper não depende só do runtime
  return buildLateralWorkflowDto(chamado, definicao) || {};
}

function resolveQueueEntryAt(chamado: IChamadoN1): Date | undefined {
  const registros = chamado.registro ?? [];
  if (!registros.length) return chamado.createdAt ?? chamado.updatedAt;
  return registros[registros.length - 1]?.data ?? chamado.createdAt ?? chamado.updatedAt;
}

const BOX_NAME_BY_STATUS: Record<string, string> = {
  novo: 'Novos',
  'em-aberto': 'Em aberto',
  'em-andamento': 'Em Andamento',
  'em-espera': 'Em espera',
  pendente: 'Pendente',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
  fechado: 'Resolvido',
};

/** Colunas fixas da fila Meus Chamados (registro.status + tabulacao.responsavel) */
export const MEUS_CHAMADOS_COLUMNS = [
  { id: 'meus-novos', name: 'Novos', status: 'novo', order: 0 },
  { id: 'meus-em-aberto', name: 'Em Aberto', status: 'em-aberto', order: 1 },
  { id: 'meus-em-andamento', name: 'Em Andamento', status: 'em-andamento', order: 2 },
  { id: 'meus-pendente', name: 'Pendente', status: 'pendente', order: 3 },
  { id: 'meus-resolvidos', name: 'Resolvidos', status: 'resolvido', order: 4 },
] as const;

const SLA_LIMIT_HOURS: Record<string, number> = {
  'em-aberto': 4,
  'em-andamento': 8,
};

const SLA_TRACKED_STATUSES = new Set(['em-aberto', 'em-andamento']);

const STATUS_VARIANTS: Record<string, string[]> = {
  novo: ['novo'],
  'em-aberto': ['em-aberto', 'em aberto'],
  'em-andamento': ['em-andamento', 'em andamento', 'em-aberto', 'em aberto'],
  pendente: ['pendente'],
  /** Fila Resolvidos: resolvido + fechado + cancelado (badge distingue o status) */
  resolvido: ['resolvido', 'fechado', 'cancelado'],
  cancelado: ['cancelado'],
  fechado: ['fechado'],
  'em-espera': ['em-espera', 'em espera', 'em-andamento', 'em andamento'],
};

/**
 * Status imutáveis / fora do snapshot ativo do Agente 3.
 * `resolvido` permanece listável (janela 48h) e não bloqueia reabertura via inbound.
 */
export const GESTAO_TERMINAL_STATUSES = ['cancelado', 'fechado'] as const;

/** Destinos de merge e filas que não aceitam novos anexos de negócio. */
export const MERGE_TERMINAL_STATUSES = ['resolvido', 'cancelado', 'fechado'] as const;

export const RESOLVED_REOPEN_WINDOW_MS = 48 * 60 * 60 * 1000;

export function gestaoTerminalStatusVariants(): string[] {
  return [...new Set(
    GESTAO_TERMINAL_STATUSES.flatMap((status) => STATUS_VARIANTS[status] ?? [status]),
  )];
}

export function mergeTerminalStatusVariants(): string[] {
  return [...new Set(
    MERGE_TERMINAL_STATUSES.flatMap((status) => STATUS_VARIANTS[status] ?? [status]),
  )];
}

export class ChamadoClosedError extends Error {
  status: number;

  constructor(message = 'Ticket fechado — não aceita modificações.', status = 409) {
    super(message);
    this.name = 'ChamadoClosedError';
    this.status = status;
  }
}

export function normalizeStatusValue(status: unknown): string {
  return String(status ?? '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function isChamadoFechado(chamado: IChamadoN1): boolean {
  return normalizeStatusValue(currentStatus(chamado)) === 'fechado';
}

/** Data do último registro com status resolvido (para janela de reabertura 48h). */
export function getResolvedAt(chamado: IChamadoN1): Date | null {
  const registros = chamado.registro ?? [];
  for (let i = registros.length - 1; i >= 0; i -= 1) {
    if (normalizeStatusValue(registros[i]?.status) === 'resolvido') {
      const d = registros[i]?.data;
      return d ? new Date(d) : null;
    }
  }
  return null;
}

export function isResolvedWithinReopenWindow(
  chamado: IChamadoN1,
  windowMs = RESOLVED_REOPEN_WINDOW_MS,
  now = Date.now(),
): boolean {
  if (normalizeStatusValue(currentStatus(chamado)) !== 'resolvido') return false;
  const resolvedAt = getResolvedAt(chamado);
  if (!resolvedAt) return false;
  return now - resolvedAt.getTime() < windowMs;
}

/**
 * Inbound: anexar no ticket existente vs criar novo.
 * - pendente / em-andamento / resolvido&lt;48h → anexar (com transição para em-aberto)
 * - fechado / cancelado / resolvido≥48h → spawn ticket novo
 */
export function shouldSpawnNewTicketOnInbound(
  chamado: IChamadoN1,
  windowMs = RESOLVED_REOPEN_WINDOW_MS,
  now = Date.now(),
): boolean {
  const status = normalizeStatusValue(currentStatus(chamado));
  if (status === 'fechado' || status === 'cancelado') return true;
  if (status === 'resolvido') {
    return !isResolvedWithinReopenWindow(chamado, windowMs, now);
  }
  return false;
}

/**
 * Status gravado ao anexar resposta do cliente no ticket existente (inbound).
 * Só deve ser chamado quando `shouldSpawnNewTicketOnInbound` é false —
 * inclui resolvido dentro da janela de 48h (antes do fechamento automático).
 */
export function resolveInboundClientReplyStatus(chamado: IChamadoN1): string | undefined {
  const status = normalizeStatusValue(currentStatus(chamado));
  if (status === 'pendente' || status === 'em-andamento' || status === 'resolvido') {
    return 'em-aberto';
  }
  return undefined;
}

export function assertChamadoModifiable(chamado: IChamadoN1): void {
  if (isChamadoFechado(chamado)) {
    throw new ChamadoClosedError();
  }
}

export function appendStatusTransition(
  chamado: IChamadoN1,
  nextStatus: string,
  params: {
    autor?: string;
    anotacaoInterna?: string;
    metadados?: Record<string, unknown>;
    origin?: RegistroOrigin;
  } = {},
): void {
  const status = normalizeStatusValue(nextStatus) || 'em-andamento';
  if (!chamado.registro) chamado.registro = [];
  chamado.registro.push({
    data: new Date(),
    origin: params.origin ?? 'agente',
    autor: params.autor ?? 'sistema',
    mensagemPublica: '',
    anexosMensagemPublica: [],
    anotacaoInterna: params.anotacaoInterna ?? '',
    anexosAnotacaoInterna: [],
    alteracoes: [{ status }],
    metadados: params.metadados ?? {},
    status,
  });
}

/** Tickets com último status diferente de resolvido/cancelado/fechado */
export function activeTicketsStatusFilter(): Record<string, unknown> {
  const terminalVariants = gestaoTerminalStatusVariants();
  return {
    $expr: {
      $not: {
        $in: [
          { $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'] },
          terminalVariants,
        ],
      },
    },
  };
}

/** Reverse lookup: nome da box → status canônico (primeiro status que mapeia para o nome). */
const STATUS_BY_BOX_NAME: Record<string, string> = {};
for (const [status, name] of Object.entries(BOX_NAME_BY_STATUS)) {
  if (STATUS_BY_BOX_NAME[name] == null) STATUS_BY_BOX_NAME[name] = status;
}

/** Campos legados embutidos em cliente[] antes da migraÃ§Ã£o v1.1.0 */
type LegacyClienteEmbed = IClienteRef & {
  clienteNome?: string;
  clienteEmail?: { lista?: string[]; resposta?: string };
  clienteTelefone?: { lista?: string[] };
};

function legacyDadosFromRef(ref?: LegacyClienteEmbed | null): IClienteDados | null {
  if (!ref?.clienteNome && !ref?.clienteCpf) return null;
  return {
    clienteCpf: ref.clienteCpf ?? '',
    clienteNome: ref.clienteNome ?? '',
    clienteEmail: {
      lista: ref.clienteEmail?.lista ?? [],
      ...(ref.clienteEmail?.resposta ? { resposta: ref.clienteEmail.resposta } : {}),
    },
    clienteTelefone: { lista: ref.clienteTelefone?.lista ?? [] },
  };
}

export function statusFromBoxName(boxName: string): string {
  if (boxName === 'Novo') return 'novo';
  if (boxName === 'Em processamento' || boxName === 'Em Processamento') return 'em-andamento';
  return STATUS_BY_BOX_NAME[boxName] ?? 'novo';
}

export function boxNameFromStatus(status: string): string {
  return BOX_NAME_BY_STATUS[status] ?? 'Novos';
}

export function currentStatus(chamado: IChamadoN1): string {
  const registros = chamado.registro ?? [];
  if (registros.length === 0) return 'novo';
  return registros[registros.length - 1].status || 'novo';
}

export function isSlaBreached(chamado: IChamadoN1): boolean {
  const status = currentStatus(chamado);
  if (!SLA_TRACKED_STATUSES.has(status)) return false;

  const limitHours = SLA_LIMIT_HOURS[status];
  if (!limitHours) return false;

  const registros = chamado.registro ?? [];
  const statusSince = registros[registros.length - 1]?.data ?? chamado.createdAt;
  if (!statusSince) return false;

  const elapsedMs = Date.now() - new Date(statusSince).getTime();
  return elapsedMs > limitHours * 60 * 60 * 1000;
}

export async function generateProtocolo(): Promise<string> {
  return allocateNextProtocolo();
}

function resolveChamadoTitulo(body: Record<string, unknown>, fallback = ''): string {
  return String(body.chamadoTitulo ?? body.title ?? fallback).trim();
}

function tabulacaoFromBody(body: Record<string, unknown>, fallbackTitle?: string): ITabulacao {
  const lateral = (body.lateralForm ?? {}) as Record<string, string>;
  return {
    tipoChamado: lateral.tipoChamado ?? lateral.classificacaoTipo ?? String(body.classificacaoTipo ?? ''),
    produto: lateral.produto ?? String(body.produto ?? ''),
    motivo: lateral.motivo ?? fallbackTitle ?? String(body.title ?? ''),
    detalhe: lateral.detalhe ?? String(body.description ?? ''),
    responsavel: sanitizeResponsavel(lateral.responsavel ?? body.responsibleAgent),
    atribuido: lateral.atribuido ?? '',
  };
}

export async function createChamadoFromBody(
  body: Record<string, unknown>,
  status = 'novo',
  authUser?: AuthPayload | null
): Promise<Partial<IChamadoN1>> {
  const titulo = resolveChamadoTitulo(body);
  const tab = tabulacaoFromBody(body, titulo);
  const internal = Boolean(body.internal);
  const text = String(body.text ?? body.description ?? '');
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const protocoloInformed = String(body.chamadoProtocolo ?? '').trim();
  const cliente = await resolveClienteRefFromBody(body);

  const clientName = String(body.clientName ?? '').trim();
  const raData = readReclameAquiFromBody(body);
  const pcData = readProconFromBody(body);
  const lf = (body.lateralForm ?? {}) as Record<string, unknown>;
  const workflowMeta = lf.workflow;

  let registro: IRegistro[];

  if (raData) {
    const complaintText = String(raData.descricao ?? text ?? '').trim();
    const raMetadados: Record<string, unknown> = {
      source: 'reclame-aqui',
      reclameAqui: raData,
    };
    const clienteRegistro: IRegistro = {
      data: new Date(),
      origin: 'cliente',
      autor: clientName || String(raData.consumidor ?? '').trim() || 'Consumidor',
      mensagemPublica: internal ? '' : complaintText,
      anexosMensagemPublica: internal ? [] : attachments,
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [],
      metadados: raMetadados,
      status,
    };
    registro = [clienteRegistro];

    if (workflowMeta && typeof workflowMeta === 'object' && !Array.isArray(workflowMeta)) {
      registro.push({
        data: new Date(),
        origin: 'agente',
        autor: resolveRegistroAutor('agente', {
          authUser,
          authorHint: String(body.author ?? '').trim(),
          clientName,
        }),
        mensagemPublica: '',
        anexosMensagemPublica: [],
        anotacaoInterna: '',
        anexosAnotacaoInterna: [],
        alteracoes: buildAlteracoesItem({ workflow: workflowMeta }),
        metadados: { workflow: workflowMeta },
        status,
      });
    }
  } else if (pcData) {
    const complaintText = String(pcData.descricao ?? text ?? '').trim();
    const pcMetadados: Record<string, unknown> = {
      source: 'procon',
      procon: pcData,
    };
    const clienteRegistro: IRegistro = {
      data: new Date(),
      origin: 'cliente',
      autor: clientName || String(pcData.consumidor ?? '').trim() || 'Consumidor',
      mensagemPublica: internal ? '' : complaintText,
      anexosMensagemPublica: internal ? [] : attachments,
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: [],
      metadados: pcMetadados,
      status,
    };
    registro = [clienteRegistro];

    if (workflowMeta && typeof workflowMeta === 'object' && !Array.isArray(workflowMeta)) {
      registro.push({
        data: new Date(),
        origin: 'agente',
        autor: resolveRegistroAutor('agente', {
          authUser,
          authorHint: String(body.author ?? '').trim(),
          clientName,
        }),
        mensagemPublica: '',
        anexosMensagemPublica: [],
        anotacaoInterna: '',
        anexosAnotacaoInterna: [],
        alteracoes: buildAlteracoesItem({ workflow: workflowMeta }),
        metadados: { workflow: workflowMeta },
        status,
      });
    }
  } else {
    const requestedOrigin = String(body.messageOrigin ?? '').trim().toLowerCase();
    const initialOrigin: RegistroOrigin = requestedOrigin === 'cliente' || body.sender === 'them'
      ? 'cliente'
      : 'agente';
    registro = [{
      data: new Date(),
      origin: initialOrigin,
      autor: resolveRegistroAutor(initialOrigin, {
        authUser,
        authorHint: String(body.author ?? '').trim(),
        clientName,
      }),
      mensagemPublica: internal ? '' : text,
      anexosMensagemPublica: internal ? [] : attachments,
      anotacaoInterna: internal ? text : '',
      anexosAnotacaoInterna: internal ? attachments : [],
      alteracoes: [],
      metadados: {
        source: String(body.source ?? body.channel ?? '').trim() || 'velodesk',
        sourceQuality: initialOrigin === 'cliente' ? 'direto_cliente' : 'resumo_atendente',
      },
      status,
    }];
  }

  await assertTabulacaoForStatus(tab, status);

  const partial: Partial<IChamadoN1> = {
    chamadoProtocolo: protocoloInformed || await generateProtocolo(),
    chamadoTitulo: titulo,
    cliente,
    tabulacao: [tab],
    registro,
  };
  ensureProconChannelStamp(partial as IChamadoN1, body, status);
  return partial;
}

export interface PrepareChamadoBodyResult {
  pendingChanges: Record<string, unknown>;
  targetStatus: string;
}

function ensureTabulacaoOnChamado(chamado: IChamadoN1): void {
  if (!chamado.tabulacao?.length) {
    chamado.tabulacao = [readTabulacaoSnapshot(null)];
  }
}

/** Aplica tabulação/cliente/workflow em memória — sem gravar registro. */
export async function prepareChamadoFromBody(
  chamado: IChamadoN1,
  body: Record<string, unknown>,
): Promise<PrepareChamadoBodyResult> {
  ensureTabulacaoOnChamado(chamado);
  const beforeTab = readTabulacaoSnapshot(chamado.tabulacao[0]);
  const pendingChanges: Record<string, unknown> = {};

  if (
    body.clientName !== undefined ||
    body.clientCPF !== undefined ||
    body.clienteId !== undefined ||
    body.lateralForm
  ) {
    const next = await resolveClienteRefFromBody(body, chamado.cliente[0]);
    if (next.length > 0) chamado.cliente = next;
  }

  if (body.chamadoTitulo !== undefined || body.title !== undefined) {
    chamado.chamadoTitulo = resolveChamadoTitulo(body, chamado.chamadoTitulo);
  }

  if (body.lateralForm || body.title || body.chamadoTitulo || body.description || body.responsibleAgent) {
    const bodyLf = (body.lateralForm ?? {}) as Record<string, unknown>;
    const lateralFormMerged: Record<string, unknown> = {
      ...beforeTab,
      tipoChamado: beforeTab.tipoChamado,
      classificacaoTipo: beforeTab.tipoChamado,
      ...bodyLf,
    };
    // Claim/roleta preenche responsável antes do merge; o Desk envia vazio (campo readonly).
    const existingResponsavel = sanitizeResponsavel(beforeTab.responsavel);
    const incomingResponsavel = sanitizeResponsavel(bodyLf.responsavel ?? body.responsibleAgent);
    if (!incomingResponsavel && existingResponsavel) {
      lateralFormMerged.responsavel = existingResponsavel;
    }

    const merged = readTabulacaoSnapshot(tabulacaoFromBody(
      {
        lateralForm: lateralFormMerged,
        ...body,
      },
      resolveChamadoTitulo(body, chamado.chamadoTitulo || beforeTab.motivo)
    ));
    Object.assign(pendingChanges, diffTabulacao(beforeTab, merged));
    chamado.tabulacao = [merged];
  }

  // Workflow pendente fica só no cache do Desk até o save; persistência via POST /workflow/start.

  let targetStatus = currentStatus(chamado);
  if (body.status !== undefined && String(body.status).trim()) {
    const nextStatus = String(body.status).trim();
    if (nextStatus !== targetStatus) {
      targetStatus = nextStatus;
      pendingChanges.status = nextStatus;
    }
  }

  return { pendingChanges, targetStatus };
}

function buildAlteracoesFromPending(pendingChanges: Record<string, unknown>): {
  alteracoes: unknown[];
  workflowMeta?: Record<string, unknown>;
} {
  const alteracoesChanges = { ...pendingChanges };
  const workflowMeta = alteracoesChanges.workflow;
  delete alteracoesChanges.status;
  delete alteracoesChanges.workflow;
  return {
    alteracoes: buildAlteracoesItem(alteracoesChanges),
    workflowMeta: workflowMeta && typeof workflowMeta === 'object' && !Array.isArray(workflowMeta)
      ? workflowMeta as Record<string, unknown>
      : undefined,
  };
}

function isValidCpfDigitsForWorkflow(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  return digits.length === 11;
}

/** CPF completo no ticket — obrigatório para iniciar workflow; save de status segue sem cliente. */
export function isClientIdentifiedOnChamado(chamado: IChamadoN1): boolean {
  const ref = chamado.cliente?.[0];
  return isValidCpfDigitsForWorkflow(String(ref?.clienteCpf ?? ''));
}

export class ChamadoCommitValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ChamadoCommitValidationError';
    this.status = status;
  }
}

export interface CommitChamadoFromAgentResult {
  messageResult: AppendRegistroResult;
  publicText: string;
  publicRegistroIndex?: number;
}

/**
 * Commit atômico do Desk: mensagem pública, nota interna, tabulação, status e responsável
 * num único chamado.save() (feito na rota).
 */
export async function commitChamadoFromAgent(
  chamado: IChamadoN1,
  body: Record<string, unknown>,
  authUser?: AuthPayload | null,
): Promise<CommitChamadoFromAgentResult> {
  assertChamadoModifiable(chamado);
  const { pendingChanges, targetStatus } = await prepareChamadoFromBody(chamado, body);
  const current = currentStatus(chamado);

  const attachmentList = Array.isArray(body.attachments)
    ? body.attachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const internalAttachmentList = Array.isArray(body.internalAttachments)
    ? body.internalAttachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];

  const publicText = String(body.text ?? '').trim();
  const internalText = String(body.internalText ?? body.anotacaoInterna ?? '').trim();
  const hasMessage = Boolean(
    publicText
    || internalText
    || attachmentList.length
    || internalAttachmentList.length,
  );

  if (hasMessage && (!body.status || !String(body.status).trim())) {
    throw new ChamadoCommitValidationError('Status obrigatório ao enviar mensagem ao cliente.');
  }

  if (targetStatus !== current) {
    await assertTabulacaoForStatus(chamado.tabulacao[0], targetStatus);
  }

  const { alteracoes, workflowMeta } = buildAlteracoesFromPending(pendingChanges);
  const authorHint = String(body.author ?? '').trim();
  let messageResult: AppendRegistroResult = {};

  if (hasMessage) {
    messageResult = appendRegistroEntry(chamado, {
      mensagemPublica: publicText,
      anotacaoInterna: internalText,
      anexosMensagemPublica: attachmentList,
      anexosAnotacaoInterna: internalAttachmentList,
      sender: String(body.sender ?? 'me'),
      autor: authorHint || undefined,
      authUser,
      alteracoes,
      metadados: workflowMeta ? { workflow: workflowMeta } : {},
      statusOverride: targetStatus,
    });
    if (!messageResult.public && !messageResult.internal) {
      throw new ChamadoCommitValidationError('Texto da mensagem ou anotação é obrigatório.');
    }
  } else if (Object.keys(pendingChanges).length) {
    chamado.registro.push({
      data: new Date(),
      origin: 'agente',
      autor: resolveRegistroAutor('agente', { authUser, authorHint }),
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes,
      metadados: workflowMeta ? { workflow: workflowMeta } : {},
      status: targetStatus,
    });
  }

  ensureProconChannelStamp(chamado, body);

  return {
    messageResult,
    publicText,
    publicRegistroIndex: messageResult.public?.registroIndex,
  };
}

export async function applyBodyToChamado(
  chamado: IChamadoN1,
  body: Record<string, unknown>,
  authUser?: AuthPayload | null
): Promise<void> {
  assertChamadoModifiable(chamado);
  const { pendingChanges, targetStatus } = await prepareChamadoFromBody(chamado, body);

  if (pendingChanges.status) {
    await assertTabulacaoForStatus(chamado.tabulacao[0], targetStatus);
  }

  if (Object.keys(pendingChanges).length) {
    const { alteracoes, workflowMeta } = buildAlteracoesFromPending(pendingChanges);
    chamado.registro.push({
      data: new Date(),
      origin: 'agente',
      autor: resolveRegistroAutor('agente', {
        authUser,
        authorHint: String(body.author ?? '').trim(),
      }),
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes,
      metadados: workflowMeta ? { workflow: workflowMeta } : {},
      status: targetStatus,
    });
  }

  ensureProconChannelStamp(chamado, body);
}

export interface AppendRegistroResult {
  public?: TicketMessageDto;
  internal?: TicketMessageDto;
}

export function appendRegistroEntry(
  chamado: IChamadoN1,
  payload: {
    mensagemPublica?: string;
    anotacaoInterna?: string;
    anexosMensagemPublica?: string[];
    anexosAnotacaoInterna?: string[];
    sender?: string;
    autor?: string;
    authUser?: AuthPayload | null;
    alteracoes?: unknown[];
    metadados?: Record<string, unknown>;
    /** Status do registro — usado no commit atômico do Desk. */
    statusOverride?: string;
  }
): AppendRegistroResult {
  const publicText = String(payload.mensagemPublica ?? '').trim();
  const internalText = String(payload.anotacaoInterna ?? '').trim();
  const publicAttachments = filterRealAttachmentUrls(payload.anexosMensagemPublica);
  const internalAttachments = filterRealAttachmentUrls(payload.anexosAnotacaoInterna);
  if (!publicText && !internalText && !publicAttachments.length && !internalAttachments.length) return {};

  const sender = payload.sender ?? 'me';
  const origin = originFromSender(sender);
  const status = String(payload.statusOverride ?? currentStatus(chamado)).trim() || currentStatus(chamado);

  const regAutor = resolveRegistroAutor(origin, {
    authUser: payload.authUser,
    authorHint: payload.autor,
    clientName: undefined,
  });

  const entry: IRegistro = {
    data: new Date(),
    origin,
    autor: regAutor,
    mensagemPublica: publicText,
    anexosMensagemPublica: publicAttachments,
    anotacaoInterna: internalText,
    anexosAnotacaoInterna: internalAttachments,
    alteracoes: payload.alteracoes ?? [],
    metadados: payload.metadados ?? {},
    status,
  };
  chamado.registro.push(entry);
  const index = chamado.registro.length - 1;

  const result: AppendRegistroResult = {};
  if (publicText || publicAttachments.length) {
    result.public = {
      id: `${index}-pub`,
      text: publicText,
      sender: senderFromOrigin(origin),
      origin,
      author: regAutor || undefined,
      type: 'public',
      time: entry.data,
      registroIndex: index,
      attachments: publicAttachments,
    };
  }
  if (internalText || internalAttachments.length) {
    result.internal = {
      id: `${index}-int`,
      text: internalText,
      sender: 'me',
      origin: 'agente',
      author: regAutor || undefined,
      type: 'internal',
      time: entry.data,
      registroIndex: index,
      attachments: internalAttachments,
    };
  }
  return result;
}

export function appendMessage(
  chamado: IChamadoN1,
  text: string,
  internal: boolean,
  sender = 'me',
  attachments: string[] = [],
  metadados: Record<string, unknown> = {},
  statusOverride?: string,
): TicketMessageDto {
  const safeAttachments = attachments.map((url) => String(url).trim()).filter(Boolean);
  const result = appendRegistroEntry(chamado, {
    mensagemPublica: internal ? '' : text,
    anotacaoInterna: internal ? text : '',
    anexosMensagemPublica: internal ? [] : safeAttachments,
    anexosAnotacaoInterna: internal ? safeAttachments : [],
    sender,
    metadados,
    statusOverride,
  });
  const dto = result.public ?? result.internal;
  if (!dto) {
    return {
      id: Date.now().toString(),
      text: '',
      sender,
      origin: originFromSender(sender),
      type: internal ? 'internal' : 'public',
      time: new Date(),
      attachments: safeAttachments,
    };
  }
  return dto;
}

function currentTabulacao(chamado: IChamadoN1) {
  const tabulacao = chamado.tabulacao ?? [];
  if (tabulacao.length === 0) return undefined;
  return tabulacao[tabulacao.length - 1];
}

export async function chamadoToTicket(
  chamado: IChamadoN1,
  boxId?: string,
  ctx?: ChamadoMapContext,
): Promise<TicketDto> {
  if (ctx?.mode === 'list') {
    return chamadoToTicketListItem(chamado, boxId, ctx);
  }
  return chamadoToTicketFull(chamado, boxId);
}

export function chamadoToTicketListItem(
  chamado: IChamadoN1,
  boxId: string | undefined,
  ctx: ChamadoMapContext,
): TicketDto {
  return buildTicketDtoCore(chamado, boxId, ctx);
}

interface FullTicketExtras {
  cadastro?: IClienteDados | null;
  lateralWorkflow?: Record<string, unknown>;
  persistedApproval?: Record<string, unknown>;
  reclameAqui?: Record<string, unknown> | null;
  procon?: Record<string, unknown> | null;
}

async function chamadoToTicketFull(
  chamado: IChamadoN1,
  boxId?: string,
): Promise<TicketDto> {
  const ref = chamado.cliente?.[0] as LegacyClienteEmbed | undefined;
  let cadastro = await loadDadosForRef(ref);
  if (!cadastro) cadastro = legacyDadosFromRef(ref);

  let lateralWorkflow: Record<string, unknown> | undefined;
  if (chamado.workflow?.active && chamado.workflow.workflowId) {
    const definicao = await loadWorkflowDefForChamado(chamado);
    if (definicao) {
      lateralWorkflow = buildLateralWorkflowDto(chamado, definicao) ?? undefined;
    }
  }
  if (!lateralWorkflow) {
    lateralWorkflow = findLatestWorkflowFromRegistro(chamado) ?? undefined;
  }

  return buildTicketDtoCore(chamado, boxId, undefined, {
    cadastro,
    lateralWorkflow,
    persistedApproval: findLatestApprovalFromRegistro(chamado) ?? undefined,
    reclameAqui: findReclameAquiFromChamado(chamado),
    procon: findProconFromChamado(chamado),
  });
}

function resolveTicketPriorityFromChamado(chamado: IChamadoN1): string {
  for (const reg of chamado.registro ?? []) {
    const mailPriority = String(reg.metadados?.mailPriority ?? '').trim().toLowerCase();
    if (mailPriority === 'alta' || mailPriority === 'critica') return mailPriority;
  }
  return 'media';
}

function buildTicketDtoCore(
  chamado: IChamadoN1,
  boxId?: string,
  ctx?: ChamadoMapContext,
  extras: FullTicketExtras = {},
): TicketDto {
  const listOnly = ctx?.mode === 'list';
  const tab = currentTabulacao(chamado);
  const ref = chamado.cliente?.[0] as LegacyClienteEmbed | undefined;
  const status = currentStatus(chamado);

  let cadastro: IClienteDados | null = extras.cadastro ?? null;
  if (!cadastro && ctx?.mode === 'list') {
    cadastro = resolveDadosFromBatch(ref, ctx.clienteBatch);
    if (!cadastro) cadastro = legacyDadosFromRef(ref);
  } else if (!cadastro) {
    cadastro = legacyDadosFromRef(ref);
  }

  const clientName = cadastro?.clienteNome;

  const messages: TicketMessageDto[] = [];
  const internalNotes: TicketMessageDto[] = [];
  const registroHistorico: RegistroHistoricoDto[] = [];

  if (!listOnly) {
    chamado.registro?.forEach((reg, index) => {
      const origin = resolveRegistroOrigin(reg);
      registroHistorico.push({
        id: `${index}-reg`,
        registroIndex: index,
        time: reg.data,
        origin,
        autor: resolveStoredRegistroAutor(reg, origin, clientName),
        alteracoes: businessAlteracoesFromRegistro(reg),
        status: reg.status || 'novo',
        anotacaoInterna: String(reg.anotacaoInterna ?? '').trim() || undefined,
      });
      const regAutor = resolveStoredRegistroAutor(reg, origin, clientName);
      const meta = registroMetadados(reg);
      const isWhatsAppThread = String(meta.source ?? '') === WHATSAPP_THREAD_SOURCE;

      if (isWhatsAppThread) {
        const waMsgs = readWhatsAppMensagens(reg);
        waMsgs.forEach((wa, waIdx) => {
          const waOrigin = wa.origin;
          messages.push({
            id: `${index}-wa-${waIdx}`,
            text: normalizeTicketMessageText(wa.texto),
            sender: senderFromOrigin(waOrigin),
            origin: waOrigin,
            author: wa.autor || regAutor || undefined,
            type: 'public',
            channel: 'whatsapp',
            time: wa.data ? new Date(wa.data) : reg.data,
            registroIndex: index,
            attachments: filterRealAttachmentUrls(wa.anexos),
          });
        });
      } else if (reg.mensagemPublica || (reg.anexosMensagemPublica?.length ?? 0) > 0) {
        const isEmailInbound = String(meta.source ?? '').toLowerCase() === 'email-inbound';
        const publicText = normalizeTicketMessageText(
          isEmailInbound
            ? extractEmailReplyContent(reg.mensagemPublica)
            : reg.mensagemPublica,
        );
        messages.push({
          id: `${index}-pub`,
          text: publicText,
          sender: senderFromOrigin(origin),
          origin,
          author: regAutor || undefined,
          type: 'public',
          time: reg.data,
          registroIndex: index,
          attachments: filterRealAttachmentUrls(reg.anexosMensagemPublica),
        });
      }
      if (reg.anotacaoInterna || (reg.anexosAnotacaoInterna?.length ?? 0) > 0) {
        internalNotes.push({
          id: `${index}-int`,
          text: normalizeTicketMessageText(reg.anotacaoInterna),
          sender: 'me',
          origin: 'agente',
          author: regAutor || undefined,
          type: 'internal',
          time: reg.data,
          registroIndex: index,
          attachments: filterRealAttachmentUrls(reg.anexosAnotacaoInterna),
        });
      }
    });
  }

  const titulo = chamado.chamadoTitulo?.trim()
    || tab?.motivo?.trim()
    || chamado.chamadoProtocolo;

  const clientCpf = ref?.clienteCpf || cadastro?.clienteCpf;

  let responsavel = sanitizeResponsavel(tab?.responsavel);
  if (!responsavel) {
    responsavel = inferResponsavelFromAgentRegistro(chamado.registro);
  }

  let lateralWorkflow: Record<string, unknown> | undefined = extras.lateralWorkflow;
  if (!lateralWorkflow && chamado.workflow?.active && chamado.workflow.workflowId && listOnly && ctx) {
    const definicao = ctx.workflowById.get(String(chamado.workflow.workflowId));
    if (definicao) {
      lateralWorkflow = buildLateralWorkflowListDto(chamado, definicao);
    }
  }
  if (!lateralWorkflow && !listOnly) {
    lateralWorkflow = findLatestWorkflowFromRegistro(chamado) ?? undefined;
  }
  const persistedApproval = listOnly ? undefined : (extras.persistedApproval ?? findLatestApprovalFromRegistro(chamado) ?? undefined);
  const reclameAquiMeta = extras.reclameAqui ?? findReclameAquiFromChamado(chamado);
  const proconMeta = extras.procon ?? findProconFromChamado(chamado);
  const reclameAqui = listOnly ? null : reclameAquiMeta;
  const procon = listOnly ? null : proconMeta;
  const especialChannel = reclameAquiMeta ? 'reclame-aqui' : proconMeta ? 'procon' : null;
  const especialSource = reclameAquiMeta ? 'reclame-aqui' : proconMeta ? 'procon' : 'velodesk';

  return {
    _id: chamado._id.toString(),
    chamadoProtocolo: chamado.chamadoProtocolo,
    chamadoTitulo: titulo,
    title: titulo,
    description: tab?.detalhe,
    status,
    priority: resolveTicketPriorityFromChamado(chamado),
    channel: especialChannel ?? 'digital',
    source: especialSource,
    boxId,
    clientName,
    clientCPF: clientCpf,
    responsibleAgent: responsavel,
    workflow: chamado.workflow?.active
      ? {
        active: chamado.workflow.active,
        workflowId: chamado.workflow.workflowId ? String(chamado.workflow.workflowId) : null,
        step: chamado.workflow.step ?? 0,
        passoId: chamado.workflow.passoId ? String(chamado.workflow.passoId) : null,
        startedAt: chamado.workflow.startedAt,
        completedAt: chamado.workflow.completedAt,
        pendingDecision: chamado.workflow.pendingDecision ?? null,
        requisicao: (() => {
          const req = chamado.workflow.requisicao;
          if (!req) return undefined;
          const comunicacao = Array.isArray(req.comunicacaoWorkflow) ? req.comunicacaoWorkflow : [];
          const comunicacaoPendente = comunicacao.length > 0;
          if (listOnly) {
            return {
              valores: req.valores || {},
              comunicacaoPendente,
            };
          }
          return {
            preenchidaEm: req.preenchidaEm,
            preenchidaPor: req.preenchidaPor,
            valores: req.valores || {},
            comunicacaoWorkflow: comunicacao.map((item) => ({
              mensagem: String(item.mensagem || ''),
              data: item.data,
              autor: String(item.autor || ''),
            })),
            comunicacaoPendente,
          };
        })(),
      }
      : undefined,
    lateralForm: {
      tipoChamado: tab?.tipoChamado,
      classificacaoTipo: tab?.tipoChamado,
      produto: tab?.produto,
      motivo: tab?.motivo,
      detalhe: tab?.detalhe,
      responsavel,
      atribuido: tab?.atribuido,
      clienteCpf: clientCpf,
      clienteNome: clientName,
      clienteEmail: listOnly ? [] : (cadastro?.clienteEmail?.lista ?? []),
      clienteEmailResposta: listOnly ? undefined : (cadastro?.clienteEmail?.resposta ?? undefined),
      clienteTelefone: listOnly ? [] : (cadastro?.clienteTelefone?.lista ?? []),
      clienteTelefoneWhatsapp: listOnly ? undefined : (cadastro?.clienteTelefone?.whatsapp ?? undefined),
      cpf: clientCpf,
      canal: reclameAquiMeta ? 'Reclame Aqui' : proconMeta ? 'Procon' : undefined,
      reclameAqui: reclameAqui ?? undefined,
      procon: procon ?? undefined,
      workflow: lateralWorkflow,
      approval: persistedApproval ?? undefined,
    },
    messages: listOnly ? [] : messages,
    internalNotes: listOnly ? [] : internalNotes,
    registroHistorico: listOnly ? [] : registroHistorico,
    slaBreached: isSlaBreached(chamado),
    createdAt: chamado.createdAt,
    updatedAt: chamado.updatedAt,
    listOnly: listOnly || undefined,
    queueEntryAt: listOnly ? resolveQueueEntryAt(chamado) : undefined,
    fusao: serializeFusaoDto(chamado.fusao),
  };
}

export function lastStatusFilter(status: string) {
  const variants = STATUS_VARIANTS[status] ?? [status];

  if (variants.length === 1) {
    return {
      $expr: {
        $eq: [{ $arrayElemAt: ['$registro.status', -1] }, variants[0]],
      },
    };
  }

  return {
    $expr: {
      $in: [{ $arrayElemAt: ['$registro.status', -1] }, variants],
    },
  };
}

export function currentResponsavel(chamado: IChamadoN1): string {
  const tabulacao = chamado.tabulacao ?? [];
  if (tabulacao.length === 0) return '';
  return tabulacao[tabulacao.length - 1]?.responsavel ?? '';
}

export function buildResponsavelCandidates(
  authUser: AuthPayload,
  dbUser?: { name?: string; email?: string } | null
): string[] {
  const values: string[] = [];
  const push = (raw?: string) => {
    const value = String(raw ?? '').trim();
    if (value) values.push(value);
  };

  push(authUser.name);
  push(authUser.email);
  push(emailLocalPart(authUser.email));
  push(authUser.userId);
  push(dbUser?.name);
  push(dbUser?.email);
  push(emailLocalPart(dbUser?.email));

  return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))];
}

function emailLocalPart(email?: string): string {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0] ?? '';
}

function lastTabulacaoResponsavelExpr() {
  return {
    $toLower: {
      $ifNull: [
        {
          $let: {
            vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
            in: '$$lastTab.responsavel',
          },
        },
        '',
      ],
    },
  };
}

export function meusChamadosResponsavelFilter(candidates: string[]) {
  if (candidates.length === 0) {
    return { _id: { $exists: false } };
  }

  const normalized = candidates.map((value) => value.toLowerCase());

  return {
    $expr: {
      $in: [lastTabulacaoResponsavelExpr(), normalized],
    },
  };
}

/** Atribuído individual (colaborador) — exclui funcao:/grupo: (escopo de time). */
export function meusChamadosAtribuidoColaboradorFilter(candidates: string[]) {
  if (candidates.length === 0) {
    return { _id: { $exists: false } };
  }

  const normalized = candidates.map((value) => value.toLowerCase());

  return {
    $and: [
      {
        $expr: {
          $not: {
            $regexMatch: {
              input: lastTabulacaoAtribuidoExpr(),
              regex: '^(funcao:|grupo:)',
            },
          },
        },
      },
      {
        $expr: {
          $in: [lastTabulacaoAtribuidoExpr(), normalized],
        },
      },
    ],
  };
}

/** Meus chamados: responsável OU atribuído colaborador igual ao agente logado. */
export function meusChamadosAgentScopeFilter(candidates: string[]) {
  return {
    $or: [
      meusChamadosResponsavelFilter(candidates),
      meusChamadosAtribuidoColaboradorFilter(candidates),
    ],
  };
}

/** Novos sem responsável = fila compartilhada; com responsável = só o agente dono */
export function meusChamadosNovosResponsavelFilter(candidates: string[]) {
  if (candidates.length === 0) {
    return { _id: { $exists: false } };
  }

  return {
    $or: [
      meusChamadosAgentScopeFilter(candidates),
      {
        $expr: {
          $eq: [lastTabulacaoResponsavelExpr(), ''],
        },
      },
    ],
  };
}

function lastTabulacaoAtribuidoExpr() {
  return {
    $toLower: {
      $ifNull: [
        {
          $let: {
            vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
            in: '$$lastTab.atribuido',
          },
        },
        '',
      ],
    },
  };
}

export function atribuidoFuncaoFilter(funcaoSlug: string) {
  const expected = `funcao:${String(funcaoSlug || '').trim().toLowerCase()}`;
  return {
    $expr: {
      $eq: [lastTabulacaoAtribuidoExpr(), expected],
    },
  };
}

/** Filtro por atribuição: qualquer uma das funções do usuário (`funcao:{slug}`). */
export function atribuidoFuncoesFilter(funcaoSlugs: string[]) {
  const expected = [
    ...new Set(
      (funcaoSlugs || [])
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean)
        .map((s) => `funcao:${s}`),
    ),
  ];
  if (!expected.length) {
    return { _id: { $exists: false } };
  }
  return {
    $expr: {
      $in: [lastTabulacaoAtribuidoExpr(), expected],
    },
  };
}

/**
 * Fila do ator de Workflow: tickets com atribuído na função OU workflow ativo
 * cuja definição é `escalonar-{funcao}` / `{funcao}` (ex.: escalonar-produtos).
 */
export function workflowActorQueueFilter(
  funcaoSlugs: string[],
  workflowDefinitionIds: Array<string | { toString(): string }>,
) {
  const atribuido = atribuidoFuncoesFilter(funcaoSlugs);
  const ids = (workflowDefinitionIds || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

  if (!ids.length) return atribuido;

  return {
    $or: [
      atribuido,
      {
        'workflow.active': true,
        'workflow.workflowId': { $in: ids },
      },
    ],
  };
}

export function buildChamadoQueryFilter(status: string, queue?: string, responsavelCandidates?: string[], extraFilter?: Record<string, unknown>) {
  const filters: Record<string, unknown>[] = [lastStatusFilter(status)];

  if (queue === 'meus-chamados' && responsavelCandidates?.length && status !== 'resolvido') {
    const responsavelFilter = status === 'novo'
      ? meusChamadosNovosResponsavelFilter(responsavelCandidates)
      : meusChamadosAgentScopeFilter(responsavelCandidates);
    filters.push(responsavelFilter);
  }

  if (queue === 'funcao-atribuido' && extraFilter) {
    filters.push(extraFilter);
  }

  return filters.length === 1 ? filters[0] : { $and: filters };
}

export async function resolveBoxIdForChamado(
  chamado: IChamadoN1,
  boxes: Array<{ _id: mongoose.Types.ObjectId; name: string }>
): Promise<string | undefined> {
  const name = boxNameFromStatus(currentStatus(chamado));
  const box = boxes.find((b) => b.name === name);
  return box?._id.toString();
}

