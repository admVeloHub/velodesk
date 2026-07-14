/** chamado.mapper v1.8.5 — novos sem responsavel visíveis para todos os agentes */
import mongoose from 'mongoose';
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1, IRegistro, ITabulacao, IClienteRef } from '../models/ChamadoN1';
import { loadDadosForRef, resolveClienteRefFromBody } from './cliente.service';
import { allocateNextProtocolo } from './protocolo.service';
import type { IClienteDados } from '../models/Cliente';
import { assertTabulacaoForStatus } from './tabulation.service';

export type RegistroOrigin = 'agente' | 'cliente';

export interface TicketMessageDto {
  id?: string;
  text: string;
  sender: string;
  origin?: RegistroOrigin;
  author?: string;
  registroIndex?: number;
  type?: string;
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

function findLatestWorkflowFromRegistro(chamado: IChamadoN1): Record<string, unknown> | null {
  const registros = chamado.registro ?? [];
  for (let i = registros.length - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(registros[i]);
    const workflow = meta.workflow;
    if (workflow && typeof workflow === 'object' && !Array.isArray(workflow)) {
      return workflow as Record<string, unknown>;
    }
  }
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

function readTabulacaoSnapshot(tab?: ITabulacao | null): ITabulacao {
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
  messages?: TicketMessageDto[];
  internalNotes?: TicketMessageDto[];
  registroHistorico?: RegistroHistoricoDto[];
  openedBy?: string;
  isDemo?: boolean;
  slaBreached?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const BOX_NAME_BY_STATUS: Record<string, string> = {
  novo: 'Novos',
  'em-aberto': 'Em aberto',
  'em-andamento': 'Em Andamento',
  'em-espera': 'Em espera',
  pendente: 'Pendente',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
};

/** Colunas fixas da fila Meus Chamados (registro.status + tabulacao.responsavel) */
export const MEUS_CHAMADOS_COLUMNS = [
  { id: 'meus-novos', name: 'Novos', status: 'novo', order: 0 },
  { id: 'meus-em-aberto', name: 'Em Aberto', status: 'em-aberto', order: 1 },
  { id: 'meus-em-andamento', name: 'Em Andamento', status: 'em-andamento', order: 2 },
  { id: 'meus-pendente', name: 'Pendente', status: 'pendente', order: 3 },
] as const;

const SLA_LIMIT_HOURS: Record<string, number> = {
  'em-aberto': 4,
  'em-andamento': 8,
};

const SLA_TRACKED_STATUSES = new Set(['em-aberto', 'em-andamento']);

const STATUS_VARIANTS: Record<string, string[]> = {
  novo: ['novo'],
  'em-aberto': ['em-aberto', 'em aberto'],
  'em-andamento': ['em-andamento', 'em andamento'],
  pendente: ['pendente'],
  resolvido: ['resolvido'],
  cancelado: ['cancelado'],
  'em-espera': ['em-espera', 'em espera', 'em-andamento', 'em andamento'],
};

const STATUS_BY_BOX_NAME = Object.fromEntries(
  Object.entries(BOX_NAME_BY_STATUS).map(([status, name]) => [name, status])
);

/** Campos legados embutidos em cliente[] antes da migraÃ§Ã£o v1.1.0 */
type LegacyClienteEmbed = IClienteRef & {
  clienteNome?: string;
  clienteEmail?: { lista?: string[] };
  clienteTelefone?: { lista?: string[] };
};

function legacyDadosFromRef(ref?: LegacyClienteEmbed | null): IClienteDados | null {
  if (!ref?.clienteNome && !ref?.clienteCpf) return null;
  return {
    clienteCpf: ref.clienteCpf ?? '',
    clienteNome: ref.clienteNome ?? '',
    clienteEmail: { lista: ref.clienteEmail?.lista ?? [] },
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
    responsavel: lateral.responsavel ?? String(body.responsibleAgent ?? ''),
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
  const registro: IRegistro = {
    data: new Date(),
    origin: 'agente',
    autor: resolveRegistroAutor('agente', {
      authUser,
      authorHint: String(body.author ?? '').trim(),
      clientName,
    }),
    mensagemPublica: internal ? '' : text,
    anexosMensagemPublica: internal ? [] : attachments,
    anotacaoInterna: internal ? text : '',
    anexosAnotacaoInterna: internal ? attachments : [],
    alteracoes: [],
    metadados: {},
    status,
  };

  await assertTabulacaoForStatus(tab, status);

  return {
    chamadoProtocolo: protocoloInformed || await generateProtocolo(),
    chamadoTitulo: titulo,
    cliente,
    tabulacao: [tab],
    registro: [registro],
  };
}

export async function applyBodyToChamado(
  chamado: IChamadoN1,
  body: Record<string, unknown>,
  authUser?: AuthPayload | null
): Promise<void> {
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
    const merged = readTabulacaoSnapshot(tabulacaoFromBody(
      {
        lateralForm: {
          ...beforeTab,
          tipoChamado: beforeTab.tipoChamado,
          classificacaoTipo: beforeTab.tipoChamado,
          ...(body.lateralForm as object),
        },
        ...body,
      },
      resolveChamadoTitulo(body, chamado.chamadoTitulo || beforeTab.motivo)
    ));
    Object.assign(pendingChanges, diffTabulacao(beforeTab, merged));
    chamado.tabulacao = [merged];
  }

  const lf = (body.lateralForm ?? {}) as Record<string, unknown>;
  const nextEscalonar = String(lf.escalonar ?? '').trim();
  const prevWorkflow = findLatestWorkflowFromRegistro(chamado);
  const nextWorkflow = lf.workflow;
  const prevWorkflowStr = prevWorkflow ? JSON.stringify(prevWorkflow) : '';
  const nextWorkflowStr = nextWorkflow ? JSON.stringify(nextWorkflow) : '';
  const workflowChanged = Boolean(nextWorkflow) && nextWorkflowStr !== prevWorkflowStr;

  if (nextEscalonar && nextEscalonar !== String(lf.lastWorkflow ?? '').trim()) {
    pendingChanges.escalonar = nextEscalonar;
  }

  if (workflowChanged) {
    pendingChanges.workflow = nextWorkflow;
  }

  if (body.status !== undefined) {
    const nextStatus = String(body.status);
    const current = currentStatus(chamado);
    if (nextStatus !== current) {
      await assertTabulacaoForStatus(chamado.tabulacao[0], nextStatus);
      pendingChanges.status = nextStatus;
    }
  }

  if (Object.keys(pendingChanges).length) {
    const nextStatus = String(pendingChanges.status ?? currentStatus(chamado));
    const tab = chamado.tabulacao[0];
    const alteracoesChanges = { ...pendingChanges };
    const workflowMeta = alteracoesChanges.workflow;
    delete alteracoesChanges.status;
    delete alteracoesChanges.workflow;
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
      alteracoes: buildAlteracoesItem(alteracoesChanges),
      metadados: workflowMeta ? { workflow: workflowMeta } : {},
      status: nextStatus,
    });
  }
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
  }
): AppendRegistroResult {
  const publicText = String(payload.mensagemPublica ?? '').trim();
  const internalText = String(payload.anotacaoInterna ?? '').trim();
  if (!publicText && !internalText) return {};

  const sender = payload.sender ?? 'me';
  const origin = originFromSender(sender);
  const status = currentStatus(chamado);
  const publicAttachments = (payload.anexosMensagemPublica ?? [])
    .map((url) => String(url).trim())
    .filter(Boolean);
  const internalAttachments = (payload.anexosAnotacaoInterna ?? [])
    .map((url) => String(url).trim())
    .filter(Boolean);

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
  if (publicText) {
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
  if (internalText) {
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
  metadados: Record<string, unknown> = {}
): TicketMessageDto {
  const safeAttachments = attachments.map((url) => String(url).trim()).filter(Boolean);
  const result = appendRegistroEntry(chamado, {
    mensagemPublica: internal ? '' : text,
    anotacaoInterna: internal ? text : '',
    anexosMensagemPublica: internal ? [] : safeAttachments,
    anexosAnotacaoInterna: internal ? safeAttachments : [],
    sender,
    metadados,
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

export async function chamadoToTicket(chamado: IChamadoN1, boxId?: string): Promise<TicketDto> {
  const tab = currentTabulacao(chamado);
  const ref = chamado.cliente?.[0] as LegacyClienteEmbed | undefined;
  const status = currentStatus(chamado);

  let cadastro = await loadDadosForRef(ref);
  if (!cadastro) cadastro = legacyDadosFromRef(ref);

  const clientName = cadastro?.clienteNome;

  const messages: TicketMessageDto[] = [];
  const internalNotes: TicketMessageDto[] = [];
  const registroHistorico: RegistroHistoricoDto[] = [];
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
    if (reg.mensagemPublica) {
      messages.push({
        id: `${index}-pub`,
        text: reg.mensagemPublica,
        sender: senderFromOrigin(origin),
        origin,
        author: regAutor || undefined,
        type: 'public',
        time: reg.data,
        registroIndex: index,
        attachments: reg.anexosMensagemPublica ?? [],
      });
    }
    if (reg.anotacaoInterna) {
      internalNotes.push({
        id: `${index}-int`,
        text: reg.anotacaoInterna,
        sender: 'me',
        origin: 'agente',
        author: regAutor || undefined,
        type: 'internal',
        time: reg.data,
        registroIndex: index,
        attachments: reg.anexosAnotacaoInterna ?? [],
      });
    }
  });

  const titulo = chamado.chamadoTitulo?.trim()
    || tab?.motivo?.trim()
    || chamado.chamadoProtocolo;

  const clientCpf = ref?.clienteCpf || cadastro?.clienteCpf;
  const persistedWorkflow = findLatestWorkflowFromRegistro(chamado);
  const persistedApproval = findLatestApprovalFromRegistro(chamado);

  return {
    _id: chamado._id.toString(),
    chamadoProtocolo: chamado.chamadoProtocolo,
    chamadoTitulo: titulo,
    title: titulo,
    description: tab?.detalhe,
    status,
    priority: 'media',
    channel: 'digital',
    source: 'velodesk',
    boxId,
    clientName,
    clientCPF: clientCpf,
    responsibleAgent: tab?.responsavel,
    lateralForm: {
      tipoChamado: tab?.tipoChamado,
      classificacaoTipo: tab?.tipoChamado,
      produto: tab?.produto,
      motivo: tab?.motivo,
      detalhe: tab?.detalhe,
      responsavel: tab?.responsavel,
      atribuido: tab?.atribuido,
      clienteCpf: clientCpf,
      clienteNome: clientName,
      clienteEmail: cadastro?.clienteEmail?.lista ?? [],
      clienteTelefone: cadastro?.clienteTelefone?.lista ?? [],
      cpf: clientCpf,
      workflow: persistedWorkflow ?? undefined,
      approval: persistedApproval ?? undefined,
    },
    messages,
    internalNotes,
    registroHistorico,
    slaBreached: isSlaBreached(chamado),
    createdAt: chamado.createdAt,
    updatedAt: chamado.updatedAt,
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

/** Novos sem responsável = fila compartilhada; com responsável = só o agente dono */
export function meusChamadosNovosResponsavelFilter(candidates: string[]) {
  if (candidates.length === 0) {
    return { _id: { $exists: false } };
  }

  return {
    $or: [
      meusChamadosResponsavelFilter(candidates),
      {
        $expr: {
          $eq: [lastTabulacaoResponsavelExpr(), ''],
        },
      },
    ],
  };
}

export function buildChamadoQueryFilter(status: string, queue?: string, responsavelCandidates?: string[]) {
  const filters: Record<string, unknown>[] = [lastStatusFilter(status)];

  if (queue === 'meus-chamados' && responsavelCandidates?.length) {
    const responsavelFilter = status === 'novo'
      ? meusChamadosNovosResponsavelFilter(responsavelCandidates)
      : meusChamadosResponsavelFilter(responsavelCandidates);
    filters.push(responsavelFilter);
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

