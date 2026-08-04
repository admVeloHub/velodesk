/**
 * Busca avançada de tickets — builder Mongo + escopo de permissão
 * VERSION: v1.1.0 | DATE: 2026-08-04
 */
import mongoose from 'mongoose';
import { ChamadoN1, type IChamadoN1 } from '../models/ChamadoN1';
import { Box } from '../models/Box';
import { User } from '../models/User';
import type { AuthPayload } from '../middleware/auth';
import {
  buildChamadoMapContext,
  buildResponsavelCandidates,
  chamadoToTicketListItem,
  currentStatus,
  isSlaBreached,
  meusChamadosResponsavelFilter,
  resolveBoxIdForChamado,
  workflowActorQueueFilter,
  type TicketDto,
} from './chamado.mapper';
import {
  hasPermission,
  resolveUserPermissions,
  shouldUseAtribuidoFuncaoQueue,
  shouldUseMeusChamadosFilter,
  type ResolvedUserPermissions,
} from './permission.service';
import { listWorkflows } from './workflowDefinicao.service';
import { excludeFusaoAbsorvidosFilter } from './ticketFusao.helpers';

export interface SearchCriterio {
  campo: string;
  operador?: string;
  valor?: string;
  valores?: string[];
}

export interface TicketSearchParams {
  criterios: SearchCriterio[];
  limit?: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

const STATUS_ALIASES: Record<string, string[]> = {
  novo: ['novo'],
  'em-andamento': ['em-andamento', 'em andamento', 'em-aberto', 'em aberto'],
  'em-aberto': ['em-aberto', 'em aberto'],
  pendente: ['pendente', 'em-espera', 'em espera'],
  'em-espera': ['em-espera', 'em espera', 'pendente'],
  resolvido: ['resolvido'],
  resolvidos: ['resolvido', 'fechado', 'cancelado'],
  fechado: ['fechado'],
  cancelado: ['cancelado'],
};

function criterioValores(c: SearchCriterio): string[] {
  if (Array.isArray(c.valores) && c.valores.length) {
    return c.valores.map((v) => String(v).trim()).filter(Boolean);
  }
  const single = String(c.valor ?? '').trim();
  return single ? [single] : [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lastTabFieldExpr(field: string) {
  return {
    $ifNull: [
      {
        $let: {
          vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
          in: `$$lastTab.${field}`,
        },
      },
      '',
    ],
  };
}

function lastStatusExpr() {
  return { $arrayElemAt: ['$registro.status', -1] };
}

function textMatchClause(path: string, operador: string, valores: string[]): Record<string, unknown> | null {
  const op = String(operador || 'equals').trim().toLowerCase();
  if (op === 'not_empty') {
    return { [path]: { $exists: true, $nin: [null, ''] } };
  }
  if (!valores.length) return null;

  if (op === 'contains') {
    return {
      $or: valores.map((v) => ({
        [path]: { $regex: escapeRegex(v), $options: 'i' },
      })),
    };
  }

  // equals / in
  if (valores.length === 1) {
    return { [path]: { $regex: `^${escapeRegex(valores[0])}$`, $options: 'i' } };
  }
  return {
    $or: valores.map((v) => ({
      [path]: { $regex: `^${escapeRegex(v)}$`, $options: 'i' },
    })),
  };
}

function exprTextMatch(fieldExpr: unknown, operador: string, valores: string[]): Record<string, unknown> | null {
  const op = String(operador || 'equals').trim().toLowerCase();
  if (op === 'not_empty') {
    return {
      $expr: {
        $and: [
          { $ne: [fieldExpr, null] },
          { $ne: [{ $trim: { input: { $toString: fieldExpr } } }, ''] },
        ],
      },
    };
  }
  if (!valores.length) return null;

  if (op === 'contains') {
    return {
      $expr: {
        $or: valores.map((v) => ({
          $regexMatch: {
            input: { $toLower: { $toString: { $ifNull: [fieldExpr, ''] } } },
            regex: escapeRegex(v.toLowerCase()),
          },
        })),
      },
    };
  }

  const lowered = valores.map((v) => v.toLowerCase());
  return {
    $expr: {
      $in: [
        { $toLower: { $toString: { $ifNull: [fieldExpr, ''] } } },
        lowered,
      ],
    },
  };
}

function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function parseDateBound(raw: string, endOfDay = false): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (endOfDay) {
      d.setUTCHours(23, 59, 59, 999);
    } else {
      d.setUTCHours(0, 0, 0, 0);
    }
  }
  return d;
}

function dateClause(path: string, operador: string, valores: string[]): Record<string, unknown> | null {
  const op = String(operador || 'gte').trim().toLowerCase();
  if (op === 'between' && valores.length >= 2) {
    const from = parseDateBound(valores[0], false);
    const to = parseDateBound(valores[1], true);
    if (!from || !to) return null;
    return { [path]: { $gte: from, $lte: to } };
  }
  if (op === 'lte') {
    const to = parseDateBound(valores[0], true);
    if (!to) return null;
    return { [path]: { $lte: to } };
  }
  // gte / equals day
  const from = parseDateBound(valores[0], false);
  if (!from) return null;
  if (op === 'equals' || op === 'on') {
    const to = parseDateBound(valores[0], true);
    return { [path]: { $gte: from, $lte: to || from } };
  }
  return { [path]: { $gte: from } };
}

function buildCriterioClause(criterio: SearchCriterio): Record<string, unknown> | null {
  const campo = String(criterio.campo || '').trim();
  const operador = String(criterio.operador || 'equals').trim();
  const valores = criterioValores(criterio);
  if (!campo) return null;

  switch (campo) {
    case 'protocolo':
    case 'chamadoProtocolo':
      return textMatchClause('chamadoProtocolo', operador, valores);

    case 'titulo':
    case 'chamadoTitulo':
      return textMatchClause('chamadoTitulo', operador, valores);

    case 'id':
    case '_id': {
      if (!valores.length) return null;
      const ids = valores
        .filter((v) => mongoose.Types.ObjectId.isValid(v))
        .map((v) => new mongoose.Types.ObjectId(v));
      if (!ids.length) return { _id: { $exists: false } };
      return ids.length === 1 ? { _id: ids[0] } : { _id: { $in: ids } };
    }

    case 'cpf':
    case 'clienteCpf': {
      if (operador === 'not_empty') {
        return { 'cliente.clienteCpf': { $exists: true, $nin: [null, ''] } };
      }
      if (!valores.length) return null;
      const digitVals = valores.map(digitsOnly).filter(Boolean);
      if (!digitVals.length) return null;
      if (operador === 'contains') {
        return {
          $or: digitVals.map((d) => ({
            'cliente.clienteCpf': { $regex: escapeRegex(d) },
          })),
        };
      }
      return {
        $or: digitVals.map((d) => ({
          'cliente.clienteCpf': { $regex: escapeRegex(d) },
        })),
      };
    }

    case 'clienteNome':
    case 'nome':
      return textMatchClause('cliente.clienteNome', operador, valores);

    case 'email':
    case 'clienteEmail':
      if (operador === 'not_empty') {
        return { 'cliente.clienteEmail.lista.0': { $exists: true } };
      }
      if (!valores.length) return null;
      return {
        $or: valores.map((v) => ({
          'cliente.clienteEmail.lista': { $regex: escapeRegex(v), $options: 'i' },
        })),
      };

    case 'telefone':
    case 'clienteTelefone': {
      if (operador === 'not_empty') {
        return { 'cliente.clienteTelefone.lista.0': { $exists: true } };
      }
      if (!valores.length) return null;
      const digitVals = valores.map(digitsOnly).filter(Boolean);
      return {
        $or: (digitVals.length ? digitVals : valores).map((v) => ({
          'cliente.clienteTelefone.lista': { $regex: escapeRegex(v), $options: 'i' },
        })),
      };
    }

    case 'status': {
      if (operador === 'not_empty') {
        return { 'registro.0.status': { $exists: true } };
      }
      if (!valores.length) return null;
      const expanded = [
        ...new Set(
          valores.flatMap((v) => {
            const key = String(v).trim().toLowerCase().replace(/\s+/g, '-');
            return STATUS_ALIASES[key] ?? [v];
          }),
        ),
      ];
      return {
        $expr: {
          $in: [lastStatusExpr(), expanded],
        },
      };
    }

    case 'tipoChamado':
    case 'produto':
    case 'motivo':
    case 'detalhe':
    case 'responsavel':
      return exprTextMatch(lastTabFieldExpr(campo), operador, valores);

    case 'atribuido': {
      const first = valores[0] || '';
      if (first === '__empty__') {
        return exprTextMatch(lastTabFieldExpr('atribuido'), 'equals', ['']);
      }
      if (first === '__me__') {
        // Frontend deve resolver __me__ para o nome; se chegar aqui, trata como not_empty
        return exprTextMatch(lastTabFieldExpr('atribuido'), 'not_empty', []);
      }
      return exprTextMatch(lastTabFieldExpr('atribuido'), operador, valores);
    }

    case 'canal':
    case 'channel':
    case 'source': {
      if (operador === 'not_empty') {
        return { 'registro.metadados.source': { $exists: true } };
      }
      if (!valores.length) return null;
      const normalized = valores.map((v) => String(v).trim().toLowerCase());
      return {
        $or: normalized.map((v) => {
          if (v === 'digital' || v === 'velodesk') {
            return {
              $and: [
                { 'registro.metadados.source': { $nin: ['reclame-aqui', 'procon'] } },
              ],
            };
          }
          return {
            $or: [
              { 'registro.metadados.source': { $regex: `^${escapeRegex(v)}$`, $options: 'i' } },
              { 'registro.metadados.canal': { $regex: escapeRegex(v), $options: 'i' } },
            ],
          };
        }),
      };
    }

    case 'prioridade':
    case 'priority': {
      if (!valores.length && operador !== 'not_empty') return null;
      if (operador === 'not_empty') {
        return { 'registro.metadados.mailPriority': { $exists: true, $nin: [null, ''] } };
      }
      const wanted = valores.map((v) => String(v).trim().toLowerCase());
      const hasMedia = wanted.includes('media') || wanted.includes('média');
      const others = wanted.filter((v) => v !== 'media' && v !== 'média');
      const clauses: Record<string, unknown>[] = [];
      if (others.length) {
        clauses.push({
          'registro.metadados.mailPriority': {
            $in: others,
          },
        });
      }
      if (hasMedia) {
        clauses.push({
          $or: [
            { 'registro.metadados.mailPriority': { $exists: false } },
            { 'registro.metadados.mailPriority': { $in: [null, '', 'media', 'média'] } },
          ],
        });
      }
      if (!clauses.length) return null;
      return clauses.length === 1 ? clauses[0] : { $or: clauses };
    }

    case 'workflow':
    case 'workflowAtivo': {
      if (!valores.length) return null;
      const wants = valores.map((v) => String(v).trim().toLowerCase());
      const clauses: Record<string, unknown>[] = [];
      if (wants.some((w) => w === 'ativo' || w === 'true' || w === '1')) {
        clauses.push({
          'workflow.active': true,
          $or: [
            { 'workflow.completedAt': null },
            { 'workflow.completedAt': { $exists: false } },
          ],
        });
      }
      if (wants.some((w) => w === 'inativo' || w === 'false' || w === '0')) {
        clauses.push({
          $or: [
            { 'workflow.active': { $ne: true } },
            { 'workflow.active': { $exists: false } },
            { 'workflow.completedAt': { $ne: null } },
          ],
        });
      }
      if (!clauses.length) return null;
      return clauses.length === 1 ? clauses[0] : { $or: clauses };
    }

    case 'pendingDecision':
    case 'workflowPendingDecision': {
      if (operador === 'not_empty') {
        return { 'workflow.pendingDecision': { $exists: true, $nin: [null, ''] } };
      }
      if (!valores.length) return null;
      return {
        'workflow.pendingDecision': {
          $in: valores.map((v) => String(v).trim().toLowerCase()),
        },
      };
    }

    case 'createdAt':
    case 'dataCriacao':
      return dateClause('createdAt', operador, valores);

    case 'updatedAt':
    case 'dataAtualizacao':
      return dateClause('updatedAt', operador, valores);

    case 'sla':
      // Filtrado pós-query (calculado)
      return null;

    default:
      return null;
  }
}

function needsSlaPostFilter(criterios: SearchCriterio[]): string[] | null {
  const sla = criterios.find((c) => String(c.campo || '').trim().toLowerCase() === 'sla');
  if (!sla) return null;
  const valores = criterioValores(sla);
  return valores.length ? valores.map((v) => String(v).trim().toLowerCase()) : null;
}

const SLA_LIMIT_HOURS: Record<string, number> = {
  'em-aberto': 4,
  'em-andamento': 8,
};

function ticketSlaTone(chamado: IChamadoN1): string {
  if (isSlaBreached(chamado)) return 'critical';
  const status = currentStatus(chamado);
  const limitHours = SLA_LIMIT_HOURS[status];
  if (!limitHours) return 'ok';
  const registros = chamado.registro ?? [];
  const statusSince = registros[registros.length - 1]?.data ?? chamado.createdAt;
  if (!statusSince) return 'ok';
  const remainingMs = limitHours * 60 * 60 * 1000 - (Date.now() - new Date(statusSince).getTime());
  const remainingMin = remainingMs / 60000;
  if (remainingMin <= 30) return 'warning';
  return 'ok';
}

async function resolveWorkflowDefinitionIdsForFuncoes(funcaoSlugs: string[]) {
  const slugs = [
    ...new Set(
      (funcaoSlugs || [])
        .map((s) => String(s || '').trim().toLowerCase())
        .filter(Boolean)
        .flatMap((s) => [`escalonar-${s}`, s]),
    ),
  ];
  if (!slugs.length) return [] as string[];

  try {
    const all = await listWorkflows(true);
    return all
      .filter((w) => slugs.includes(String(w.slug || '').trim().toLowerCase()))
      .map((w) => String(w._id));
  } catch (err) {
    console.warn(
      '[ticket-search] não foi possível carregar definições de workflow:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function buildVisibilityFilter(
  resolved: ResolvedUserPermissions,
): Promise<Record<string, unknown> | null> {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) {
    return null;
  }

  if (shouldUseAtribuidoFuncaoQueue(resolved)) {
    const slugs = [
      ...new Set(
        [resolved.funcaoSlug, ...(resolved.funcoes || [])]
          .map((s) => String(s || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const workflowIds = await resolveWorkflowDefinitionIdsForFuncoes(slugs);
    return workflowActorQueueFilter(slugs, workflowIds);
  }

  if (shouldUseMeusChamadosFilter(resolved)) {
    return meusChamadosResponsavelFilter(resolved.responsavelCandidates);
  }

  return null;
}

export function normalizeSearchCriterios(raw: unknown): SearchCriterio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const campo = String(row.campo || row.field || row.tipo || '').trim();
      if (!campo) return null;
      const valores = Array.isArray(row.valores)
        ? row.valores.map((v) => String(v).trim()).filter(Boolean)
        : undefined;
      const valor = row.valor != null ? String(row.valor).trim() : '';
      return {
        campo,
        operador: String(row.operador || 'equals').trim() || 'equals',
        valor: valor || (valores?.[0] || ''),
        valores: valores?.length ? valores : valor ? [valor] : [],
      } as SearchCriterio;
    })
    .filter(Boolean) as SearchCriterio[];
}

export function clampSearchLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

export async function searchTickets(
  authUser: AuthPayload,
  params: TicketSearchParams,
): Promise<{ tickets: TicketDto[]; total: number; limit: number }> {
  const criterios = normalizeSearchCriterios(params.criterios);
  const limit = clampSearchLimit(params.limit);

  if (!criterios.length) {
    return { tickets: [], total: 0, limit };
  }

  const resolved = await resolveUserPermissions(authUser);
  // Garante candidates mesmo se resolveUserPermissions já tiver — rebuild seguro
  if (!resolved.responsavelCandidates?.length) {
    const dbUser = authUser.userId && mongoose.Types.ObjectId.isValid(authUser.userId)
      ? await User.findById(authUser.userId).select('name email').lean()
      : null;
    resolved.responsavelCandidates = buildResponsavelCandidates(authUser, dbUser);
  }

  const andClauses: Record<string, unknown>[] = [];
  const visibility = await buildVisibilityFilter(resolved);
  if (visibility) andClauses.push(visibility);

  for (const criterio of criterios) {
    const campo = String(criterio.campo || '').trim().toLowerCase();
    if (campo === 'sla') continue;
    const clause = buildCriterioClause(criterio);
    if (clause) andClauses.push(clause);
  }

  // Se só havia SLA e nada mais montável além da visibilidade, ainda permite busca
  const hasNonSla = criterios.some((c) => String(c.campo || '').trim().toLowerCase() !== 'sla');
  if (!hasNonSla && !needsSlaPostFilter(criterios)) {
    return { tickets: [], total: 0, limit };
  }
  if (hasNonSla && andClauses.length === (visibility ? 1 : 0)) {
    // Todos os critérios não-SLA foram inválidos
    const onlyVisibility = Boolean(visibility) && andClauses.length === 1;
    if (!onlyVisibility) {
      return { tickets: [], total: 0, limit };
    }
  }

  const filter: Record<string, unknown> = andClauses.length === 0
    ? {}
    : andClauses.length === 1
      ? andClauses[0]
      : { $and: andClauses };

  const slaWanted = needsSlaPostFilter(criterios);
  const fetchLimit = slaWanted ? Math.min(limit * 3, MAX_LIMIT * 2) : limit;

  const chamados = await ChamadoN1.find(filter).sort({ updatedAt: -1 }).limit(fetchLimit);
  const boxes = await Box.find().sort({ order: 1 });
  const ctx = await buildChamadoMapContext(chamados, 'list');

  let tickets: TicketDto[] = [];
  for (const chamado of chamados) {
    const boxId = await resolveBoxIdForChamado(chamado, boxes);
    const ticket = chamadoToTicketListItem(chamado, boxId, ctx);
    if (slaWanted) {
      const tone = ticketSlaTone(chamado);
      if (!slaWanted.includes(tone)) continue;
    }
    tickets.push(ticket);
    if (tickets.length >= limit) break;
  }

  return {
    tickets,
    total: tickets.length,
    limit,
  };
}

const BY_CPF_LIMIT = 500;

function digitsOnlyCpf(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Lista tickets do CPF no Mongo (histórico Client360), excluindo absorvidos da fusão.
 */
export async function searchTicketsByCpf(
  authUser: AuthPayload,
  cpfRaw: string,
): Promise<{ tickets: TicketDto[]; total: number; cpf: string }> {
  const cpf = digitsOnlyCpf(cpfRaw);
  if (cpf.length !== 11) {
    throw Object.assign(new Error('CPF inválido'), { status: 400 });
  }

  const resolved = await resolveUserPermissions(authUser);
  if (!resolved.responsavelCandidates?.length) {
    const dbUser = authUser.userId && mongoose.Types.ObjectId.isValid(authUser.userId)
      ? await User.findById(authUser.userId).select('name email').lean()
      : null;
    resolved.responsavelCandidates = buildResponsavelCandidates(authUser, dbUser);
  }

  const andClauses: Record<string, unknown>[] = [
    {
      $or: [
        { 'cliente.clienteCpf': cpf },
        { 'cliente.clienteCpf': { $regex: escapeRegex(cpf) } },
      ],
    },
    excludeFusaoAbsorvidosFilter(),
  ];

  const visibility = await buildVisibilityFilter(resolved);
  if (visibility) andClauses.push(visibility);

  const filter = { $and: andClauses };
  const chamados = await ChamadoN1.find(filter).sort({ updatedAt: -1 }).limit(BY_CPF_LIMIT);
  const boxes = await Box.find().sort({ order: 1 });
  const ctx = await buildChamadoMapContext(chamados, 'list');

  const tickets: TicketDto[] = [];
  for (const chamado of chamados) {
    const boxId = await resolveBoxIdForChamado(chamado, boxes);
    tickets.push(chamadoToTicketListItem(chamado, boxId, ctx));
  }

  return { tickets, total: tickets.length, cpf };
}
