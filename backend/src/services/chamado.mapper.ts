/** chamado.mapper v1.0.8 — create com protocolo informado, mensagem inicial e status */
import mongoose from 'mongoose';
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1, IRegistro, ITabulacao } from '../models/ChamadoN1';

export interface TicketMessageDto {
  id?: string;
  text: string;
  sender: string;
  type?: string;
  time: Date;
  attachments?: string[];
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

/** Limites de SLA por status (horas no status atual) — ajustável quando houver regra oficial */
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

export function generateProtocolo(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `VD-${stamp}-${suffix}`;
}

function resolveChamadoTitulo(body: Record<string, unknown>, fallback = ''): string {
  return String(body.chamadoTitulo ?? body.title ?? fallback).trim();
}

function normalizeStringList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    return items.length > 0 ? items : fallback;
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return fallback;
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

function clienteFromBody(body: Record<string, unknown>, existing?: IChamadoN1['cliente'][0]) {
  const lateral = (body.lateralForm ?? {}) as Record<string, unknown>;
  const cpf = String(body.clientCPF ?? lateral.clienteCpf ?? lateral.cpf ?? existing?.clienteCpf ?? '');
  const nome = String(body.clientName ?? lateral.clienteNome ?? existing?.clienteNome ?? '');
  const emailLista = normalizeStringList(
    lateral.clienteEmail,
    existing?.clienteEmail?.lista ?? []
  );
  const telLista = normalizeStringList(
    lateral.clienteTelefone,
    existing?.clienteTelefone?.lista ?? []
  );

  if (!cpf && !nome && emailLista.length === 0 && telLista.length === 0) return [];

  return [
    {
      clienteCpf: cpf,
      clienteNome: nome,
      clienteEmail: { lista: emailLista },
      clienteTelefone: { lista: telLista },
    },
  ];
}

export function createChamadoFromBody(body: Record<string, unknown>, status = 'novo'): Partial<IChamadoN1> {
  const titulo = resolveChamadoTitulo(body);
  const tab = tabulacaoFromBody(body, titulo);
  const internal = Boolean(body.internal);
  const text = String(body.text ?? body.description ?? '');
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  const protocoloInformed = String(body.chamadoProtocolo ?? '').trim();

  const registro: IRegistro = {
    data: new Date(),
    mensagemPublica: internal ? '' : text,
    anexosMensagemPublica: internal ? [] : attachments,
    anotacaoInterna: internal ? text : '',
    anexosAnotacaoInterna: internal ? attachments : [],
    alteracoes: {},
    status,
  };

  return {
    chamadoProtocolo: protocoloInformed || generateProtocolo(),
    chamadoTitulo: titulo,
    cliente: clienteFromBody(body),
    tabulacao: [tab],
    registro: [registro],
  };
}

export function applyBodyToChamado(chamado: IChamadoN1, body: Record<string, unknown>): void {
  if (body.clientName !== undefined || body.clientCPF !== undefined || body.lateralForm) {
    const next = clienteFromBody(
      {
        ...body,
        clientName: body.clientName ?? chamado.cliente[0]?.clienteNome,
        clientCPF: body.clientCPF ?? chamado.cliente[0]?.clienteCpf,
      },
      chamado.cliente[0]
    );
    if (next.length > 0) chamado.cliente = next;
  }

  if (body.chamadoTitulo !== undefined || body.title !== undefined) {
    chamado.chamadoTitulo = resolveChamadoTitulo(body, chamado.chamadoTitulo);
  }

  if (body.lateralForm || body.title || body.chamadoTitulo || body.description || body.responsibleAgent) {
    const current = chamado.tabulacao[0] ?? tabulacaoFromBody({});
    const merged = tabulacaoFromBody(
      { lateralForm: { ...current, ...(body.lateralForm as object) }, ...body },
      resolveChamadoTitulo(body, chamado.chamadoTitulo || current.motivo)
    );
    chamado.tabulacao = [merged];
  }

  if (body.status !== undefined) {
    const registros = chamado.registro ?? [];
    const last = registros[registros.length - 1];
    chamado.registro.push({
      data: new Date(),
      mensagemPublica: '',
      anexosMensagemPublica: [],
      anotacaoInterna: '',
      anexosAnotacaoInterna: [],
      alteracoes: { status: { de: last?.status, para: body.status } },
      status: String(body.status),
    });
  }
}

export function appendMessage(
  chamado: IChamadoN1,
  text: string,
  internal: boolean,
  sender = 'me',
  attachments: string[] = []
): TicketMessageDto {
  const status = currentStatus(chamado);
  const safeAttachments = attachments.map((url) => String(url).trim()).filter(Boolean);
  const entry: IRegistro = {
    data: new Date(),
    mensagemPublica: internal ? '' : text,
    anexosMensagemPublica: internal ? [] : safeAttachments,
    anotacaoInterna: internal ? text : '',
    anexosAnotacaoInterna: internal ? safeAttachments : [],
    alteracoes: { sender },
    status,
  };
  chamado.registro.push(entry);
  return {
    id: Date.now().toString(),
    text,
    sender,
    type: internal ? 'internal' : 'public',
    time: entry.data,
    attachments: safeAttachments,
  };
}

export function chamadoToTicket(chamado: IChamadoN1, boxId?: string): TicketDto {
  const tab = chamado.tabulacao?.[0];
  const cliente = chamado.cliente?.[0];
  const status = currentStatus(chamado);

  const messages: TicketMessageDto[] = [];
  const internalNotes: TicketMessageDto[] = [];
  chamado.registro?.forEach((reg, index) => {
    if (reg.mensagemPublica) {
      messages.push({
        id: `${index}-pub`,
        text: reg.mensagemPublica,
        sender: 'them',
        type: 'public',
        time: reg.data,
        attachments: reg.anexosMensagemPublica ?? [],
      });
    }
    if (reg.anotacaoInterna) {
      internalNotes.push({
        id: `${index}-int`,
        text: reg.anotacaoInterna,
        sender: 'me',
        type: 'internal',
        time: reg.data,
        attachments: reg.anexosAnotacaoInterna ?? [],
      });
    }
  });

  const titulo = chamado.chamadoTitulo?.trim()
    || tab?.motivo?.trim()
    || chamado.chamadoProtocolo;

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
    clientName: cliente?.clienteNome,
    clientCPF: cliente?.clienteCpf,
    responsibleAgent: tab?.responsavel,
    lateralForm: {
      tipoChamado: tab?.tipoChamado,
      classificacaoTipo: tab?.tipoChamado,
      produto: tab?.produto,
      motivo: tab?.motivo,
      detalhe: tab?.detalhe,
      responsavel: tab?.responsavel,
      atribuido: tab?.atribuido,
      clienteCpf: cliente?.clienteCpf,
      clienteNome: cliente?.clienteNome,
      clienteEmail: cliente?.clienteEmail?.lista ?? [],
      clienteTelefone: cliente?.clienteTelefone?.lista ?? [],
      cpf: cliente?.clienteCpf,
    },
    messages,
    internalNotes,
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
  const values = [authUser.name, authUser.email, authUser.userId, dbUser?.name, dbUser?.email];
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

export function meusChamadosResponsavelFilter(candidates: string[]) {
  if (candidates.length === 0) {
    return { _id: { $exists: false } };
  }

  const normalized = candidates.map((value) => value.toLowerCase());

  return {
    $expr: {
      $in: [
        {
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
        },
        normalized,
      ],
    },
  };
}

export function buildChamadoQueryFilter(status: string, queue?: string, responsavelCandidates?: string[]) {
  const filters: Record<string, unknown>[] = [lastStatusFilter(status)];

  if (queue === 'meus-chamados' && responsavelCandidates?.length) {
    filters.push(meusChamadosResponsavelFilter(responsavelCandidates));
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
