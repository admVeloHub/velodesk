/** boxes.routes v1.8.0 — GET /boxes/queue-counts (contadores reais, independente da listagem) */
import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { isMongoConnected } from '../config/database';
import { Box } from '../models/Box';
import { ChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import {
  buildBoxListFindOptions,
  buildChamadoMapContext,
  buildResponsavelCandidates,
  chamadoToTicketListItem,
  MEUS_CHAMADOS_COLUMNS,
  statusFromBoxName,
  workflowActorQueueFilter,
} from '../services/chamado.mapper';
import {
  hasPermission,
  resolveUserPermissions,
  shouldUseAtribuidoFuncaoQueue,
  shouldUseMeusChamadosFilter,
} from '../services/permission.service';
import { listWorkflows } from '../services/workflowDefinicao.service';

const router = Router();

async function resolveDbUser(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select('name email');
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
      '[boxes] não foi possível carregar definições de workflow para filtro de fila:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function resolveQueueMode(
  resolved: Awaited<ReturnType<typeof resolveUserPermissions>>,
  queueParam?: string,
) {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) {
    return { queue: queueParam, extraFilter: undefined as Record<string, unknown> | undefined };
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
    return {
      queue: 'funcao-atribuido',
      extraFilter: workflowActorQueueFilter(slugs, workflowIds),
    };
  }
  if (shouldUseMeusChamadosFilter(resolved)) {
    return { queue: 'meus-chamados', extraFilter: undefined };
  }
  return { queue: queueParam, extraFilter: undefined };
}

const TERMINAL_COLUMN_STATUSES = new Set(['resolvido', 'cancelado', 'fechado']);

function deskQueueIdFromColumn(column: { id: string; status: string }): string {
  const id = String(column.id || '').trim();
  if (id === 'meus-novos') return 'novos';
  if (id === 'meus-em-aberto' || id === 'meus-em-andamento') return 'em-andamento';
  if (id === 'meus-pendente') return 'pendente';
  if (id === 'meus-resolvidos') return 'resolvidos';

  const status = String(column.status || '').trim().toLowerCase();
  if (status === 'novo') return 'novos';
  if (status === 'em-aberto' || status === 'em-andamento') return 'em-andamento';
  if (status === 'pendente' || status === 'em-espera') return 'pendente';
  if (TERMINAL_COLUMN_STATUSES.has(status)) return 'resolvidos';
  return 'em-andamento';
}

async function loadQueueCounts(
  columns: Array<{ id: string; name: string; order: number; status: string }>,
  queue: string | undefined,
  responsavelCandidates: string[],
  extraFilter?: Record<string, unknown>,
) {
  const counts: Record<string, number> = {
    novos: 0,
    'em-andamento': 0,
    pendente: 0,
    resolvidos: 0,
  };

  await Promise.all(
    columns.map(async (column) => {
      const { filter } = buildBoxListFindOptions(
        column.status,
        queue,
        responsavelCandidates,
        extraFilter,
      );
      const deskQueueId = deskQueueIdFromColumn(column);
      const total = await ChamadoN1.countDocuments(filter);
      counts[deskQueueId] = (counts[deskQueueId] || 0) + total;
    }),
  );

  return counts;
}

async function loadBoxesWithListTickets(
  columns: Array<{ id: string; name: string; order: number; status: string }>,
  queue: string | undefined,
  responsavelCandidates: string[],
  extraFilter?: Record<string, unknown>,
) {
  const loaded = await Promise.all(
    columns.map(async (column) => {
      const { filter, limit, sort } = buildBoxListFindOptions(
        column.status,
        queue,
        responsavelCandidates,
        extraFilter,
      );
      const chamados = await ChamadoN1.find(filter).sort(sort).limit(limit);
      return { column, chamados };
    }),
  );

  const allChamados = loaded.flatMap((entry) => entry.chamados);
  const ctx = await buildChamadoMapContext(allChamados, 'list');

  return loaded.map(({ column, chamados }) => ({
    id: column.id,
    name: column.name,
    order: column.order,
    tickets: chamados.map((chamado) => chamadoToTicketListItem(chamado, column.id, ctx)),
  }));
}

router.get('/queue-counts', authMiddleware, async (req, res: Response) => {
  const queueParam = typeof req.query.fila === 'string' ? req.query.fila : undefined;
  const userId = req.user?.userId;

  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Banco de chamados indisponível' });
    }
    const dbUser = await resolveDbUser(userId);
    const resolved = await resolveUserPermissions(req.user!);
    const responsavelCandidates = buildResponsavelCandidates(req.user!, dbUser);
    const { queue, extraFilter } = await resolveQueueMode(resolved, queueParam);

    let counts: Record<string, number>;
    if (queue === 'meus-chamados') {
      counts = await loadQueueCounts(
        MEUS_CHAMADOS_COLUMNS.map((column) => ({
          id: column.id,
          name: column.name,
          order: column.order,
          status: column.status,
        })),
        queue,
        responsavelCandidates,
      );
    } else {
      const boxes = await Box.find().sort({ order: 1 });
      const columns = boxes.map((box) => ({
        id: box.id,
        name: box.name,
        order: box.order,
        status: statusFromBoxName(box.name),
      }));
      counts = await loadQueueCounts(columns, queue, responsavelCandidates, extraFilter);
    }

    return res.json({
      counts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[boxes] GET /queue-counts falhou:', message);
    return res.status(500).json({ message: 'Erro ao carregar contadores das filas' });
  }
});

router.get('/', authMiddleware, async (req, res: Response) => {
  const queueParam = typeof req.query.fila === 'string' ? req.query.fila : undefined;
  const userId = req.user?.userId;

  try {
    if (!isMongoConnected()) {
      return res.status(503).json({ message: 'Banco de chamados indisponível' });
    }
    const dbUser = await resolveDbUser(userId);
    const resolved = await resolveUserPermissions(req.user!);
    const responsavelCandidates = buildResponsavelCandidates(req.user!, dbUser);
    const { queue, extraFilter } = await resolveQueueMode(resolved, queueParam);

    if (queue === 'meus-chamados') {
      const result = await loadBoxesWithListTickets(
        MEUS_CHAMADOS_COLUMNS.map((column) => ({
          id: column.id,
          name: column.name,
          order: column.order,
          status: column.status,
        })),
        queue,
        responsavelCandidates,
      );
      return res.json(result);
    }

    const boxes = await Box.find().sort({ order: 1 });
    const columns = boxes.map((box) => ({
      id: box.id,
      name: box.name,
      order: box.order,
      status: statusFromBoxName(box.name),
    }));
    const result = await loadBoxesWithListTickets(
      columns,
      queue,
      responsavelCandidates,
      extraFilter,
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[boxes] GET falhou:', message);
    res.status(500).json({ message: 'Erro ao carregar boxes' });
  }
});

export default router;
