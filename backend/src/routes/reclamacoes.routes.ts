/** reclamacoes.routes v1.0.0 — API chamados_reclamacoes por órgão */
import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import type { AuthPayload } from '../middleware/auth';
import { isReclamacoesConnected } from '../config/database';
import {
  resolveUserPermissions,
  hasPermission,
} from '../services/permission.service';
import {
  findByIdOrgao,
  findByChamadoId,
  listByOrgao,
  parseReclamacaoOrgaoRoute,
  patchReclamacao,
  reclamacaoToPortalDto,
} from '../services/reclamacoes/reclamacao.service';
import type { CasoEspecialOrgao } from '../services/agents/casosEspeciais.types';
import { createChamadoFromBody } from '../services/chamado.mapper';
import { ChamadoN1 } from '../models/ChamadoN1';
import { runCasosEspeciaisTriagem } from '../services/agents/casosEspeciaisTrigger.service';

const router = Router();

const ORGAO_FUNCAO_SLUG: Record<Exclude<CasoEspecialOrgao, 'indefinido'>, string> = {
  reclame_aqui: 'reclame-aqui',
  procon: 'procon',
  bacen: 'bacen',
  consumidor_gov: 'consumidor-gov',
};

const ORGAO_PERM_KEY: Record<Exclude<CasoEspecialOrgao, 'indefinido'>, string> = {
  reclame_aqui: 'reclame_aqui_gerenciar',
  procon: 'procon_gerenciar',
  bacen: 'bacen_gerenciar',
  consumidor_gov: 'consumidor_gov_gerenciar',
};

async function assertCanAccessOrgao(
  authUser: AuthPayload,
  orgao: CasoEspecialOrgao,
): Promise<void> {
  if (orgao === 'indefinido') {
    throw Object.assign(new Error('Órgão inválido'), { status: 400 });
  }

  const resolved = await resolveUserPermissions(authUser);
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return;
  if (resolved.funcaoSlug === 'gestao' || resolved.funcoes.includes('gestao')) return;

  const funcaoSlug = ORGAO_FUNCAO_SLUG[orgao];
  if (resolved.funcoes.includes(funcaoSlug) || resolved.funcaoSlug === funcaoSlug) return;

  const permKey = ORGAO_PERM_KEY[orgao];
  if (hasPermission(resolved.permissoes, 'especiais', permKey)) return;

  throw Object.assign(new Error('Sem permissão para este canal'), { status: 403 });
}

function parseOrgaoParam(raw: string): CasoEspecialOrgao {
  const orgao = parseReclamacaoOrgaoRoute(raw);
  if (!orgao) {
    throw Object.assign(new Error('Órgão inválido'), { status: 400 });
  }
  return orgao;
}

router.get('/:orgao', authMiddleware, async (req, res: Response) => {
  if (!isReclamacoesConnected()) {
    return res.status(503).json({ message: 'Banco chamados_reclamacoes indisponível' });
  }

  try {
    const orgao = parseOrgaoParam(String(req.params.orgao));
    await assertCanAccessOrgao(req.user!, orgao);

    const aberta = req.query.aberta === 'true'
      ? true
      : req.query.aberta === 'false'
        ? false
        : undefined;
    const limit = parseInt(String(req.query.limit ?? '200'), 10) || 200;
    const skip = parseInt(String(req.query.skip ?? '0'), 10) || 0;

    const items = await listByOrgao(orgao, {
      aberta,
      statusCanal: typeof req.query.statusCanal === 'string' ? req.query.statusCanal : undefined,
      limit,
      skip,
    });

    return res.json({
      items: items.map(reclamacaoToPortalDto),
      total: items.length,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Erro ao listar reclamações';
    return res.status(status).json({ message });
  }
});

router.get('/:orgao/by-ticket/:chamadoId', authMiddleware, async (req, res: Response) => {
  if (!isReclamacoesConnected()) {
    return res.status(503).json({ message: 'Banco chamados_reclamacoes indisponível' });
  }

  try {
    const orgao = parseOrgaoParam(String(req.params.orgao));
    await assertCanAccessOrgao(req.user!, orgao);

    const doc = await findByChamadoId(orgao, String(req.params.chamadoId));
    if (!doc) return res.status(404).json({ message: 'Reclamação não encontrada' });
    return res.json(reclamacaoToPortalDto(doc));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Erro ao buscar reclamação';
    return res.status(status).json({ message });
  }
});

router.get('/:orgao/:id', authMiddleware, async (req, res: Response) => {
  if (!isReclamacoesConnected()) {
    return res.status(503).json({ message: 'Banco chamados_reclamacoes indisponível' });
  }

  try {
    const orgao = parseOrgaoParam(String(req.params.orgao));
    await assertCanAccessOrgao(req.user!, orgao);

    const doc = await findByIdOrgao(orgao, String(req.params.id));
    if (!doc) return res.status(404).json({ message: 'Reclamação não encontrada' });
    return res.json(reclamacaoToPortalDto(doc));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Erro ao buscar reclamação';
    return res.status(status).json({ message });
  }
});

router.post('/:orgao', authMiddleware, async (req, res: Response) => {
  if (!isReclamacoesConnected()) {
    return res.status(503).json({ message: 'Banco chamados_reclamacoes indisponível' });
  }

  try {
    const orgao = parseOrgaoParam(String(req.params.orgao));
    await assertCanAccessOrgao(req.user!, orgao);

    const body = req.body ?? {};
    const chamadoId = String(body.chamadoId ?? body.ticketId ?? '').trim();

    if (chamadoId) {
      const chamado = await ChamadoN1.findById(chamadoId);
      if (!chamado) return res.status(404).json({ message: 'Ticket não encontrado' });

      await runCasosEspeciaisTriagem(chamado, { source: 'reclamacoes-manual' });
      const doc = await findByChamadoId(orgao, chamadoId);
      if (!doc) {
        return res.status(202).json({
          message: 'Triagem executada; reclamação pendente de validação IA',
          chamadoId,
        });
      }
      return res.status(201).json(reclamacaoToPortalDto(doc));
    }

    const ticketBody = body.ticket ?? body;
    if (!ticketBody || typeof ticketBody !== 'object') {
      return res.status(400).json({ message: 'Payload ticket ou chamadoId obrigatório' });
    }

    const partial = await createChamadoFromBody(ticketBody as Record<string, unknown>, 'novo');
    const chamado = await ChamadoN1.create(partial);
    await runCasosEspeciaisTriagem(chamado, { source: 'reclamacoes-register' });

    const doc = await findByChamadoId(orgao, chamado._id.toString());
    return res.status(201).json({
      chamadoId: chamado._id.toString(),
      chamadoProtocolo: chamado.chamadoProtocolo,
      reclamacao: doc ? reclamacaoToPortalDto(doc) : null,
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Erro ao registrar reclamação';
    return res.status(status).json({ message });
  }
});

router.patch('/:orgao/:id', authMiddleware, async (req, res: Response) => {
  if (!isReclamacoesConnected()) {
    return res.status(503).json({ message: 'Banco chamados_reclamacoes indisponível' });
  }

  try {
    const orgao = parseOrgaoParam(String(req.params.orgao));
    await assertCanAccessOrgao(req.user!, orgao);

    const doc = await patchReclamacao(orgao, String(req.params.id), req.body ?? {});
    if (!doc) return res.status(404).json({ message: 'Reclamação não encontrada' });
    return res.json(reclamacaoToPortalDto(doc));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Erro ao atualizar reclamação';
    return res.status(status).json({ message });
  }
});

export default router;
