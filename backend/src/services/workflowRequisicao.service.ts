/** workflowRequisicao.service v1.2.0 — markModified ao append comunicacaoWorkflow */
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1 } from '../models/ChamadoN1';
import type { IWorkflowDefinicao } from '../models/WorkflowDefinicao';
import {
  type IChamadoWorkflowComunicacao,
  type IChamadoWorkflowRequisicao,
  normalizeRequisicaoConfig,
  validateRequisicaoValores,
  WorkflowRequisicaoError,
} from '../config/workflowRequisicaoDefaults';
import { appendRegistroEntry } from './chamado.mapper';

export { WorkflowRequisicaoError };

export type ComunicacaoOrigem = 'workflow' | 'responsavel';

export function getRequisicaoConfig(definicao: IWorkflowDefinicao) {
  return normalizeRequisicaoConfig(definicao.requisicao, definicao.gatilho);
}

export function buildRequisicaoSnapshot(
  definicao: IWorkflowDefinicao,
  valores: Record<string, unknown> | undefined,
  authUser?: AuthPayload | null,
): IChamadoWorkflowRequisicao | null {
  const config = getRequisicaoConfig(definicao);
  if (!config.campos.length) return null;

  const parsed = validateRequisicaoValores(config, valores || {});
  if (!parsed.ok) {
    throw new WorkflowRequisicaoError(parsed.message, 400);
  }

  return {
    preenchidaEm: new Date(),
    preenchidaPor: authUser?.name || authUser?.email || 'Agente',
    valores: parsed.valores,
    comunicacaoWorkflow: [],
  };
}

export function applyRequisicaoToChamado(
  chamado: IChamadoN1,
  snapshot: IChamadoWorkflowRequisicao | null,
): void {
  if (!snapshot || !chamado.workflow) return;
  const prev = chamado.workflow.requisicao;
  chamado.workflow.requisicao = {
    ...snapshot,
    comunicacaoWorkflow: prev?.comunicacaoWorkflow?.length
      ? prev.comunicacaoWorkflow
      : (snapshot.comunicacaoWorkflow || []),
  };
}

function ensureRequisicaoShell(chamado: IChamadoN1): IChamadoWorkflowRequisicao {
  if (!chamado.workflow) {
    throw new WorkflowRequisicaoError('Ticket sem workflow ativo', 400);
  }
  if (!chamado.workflow.active) {
    throw new WorkflowRequisicaoError('Ticket sem workflow ativo', 400);
  }
  if (!chamado.workflow.requisicao) {
    chamado.workflow.requisicao = {
      preenchidaEm: new Date(),
      preenchidaPor: '',
      valores: {},
      comunicacaoWorkflow: [],
    };
  }
  if (!Array.isArray(chamado.workflow.requisicao.comunicacaoWorkflow)) {
    chamado.workflow.requisicao.comunicacaoWorkflow = [];
  }
  return chamado.workflow.requisicao;
}

export function appendComunicacaoWorkflow(
  chamado: IChamadoN1,
  payload: { mensagem: string; origem: ComunicacaoOrigem },
  authUser?: AuthPayload | null,
): IChamadoWorkflowComunicacao {
  const texto = String(payload.mensagem || '').trim();
  if (!texto) {
    throw new WorkflowRequisicaoError('Mensagem obrigatória', 400);
  }
  if (payload.origem !== 'workflow' && payload.origem !== 'responsavel') {
    throw new WorkflowRequisicaoError('Origem inválida', 400);
  }

  const requisicao = ensureRequisicaoShell(chamado);
  const nome = authUser?.name || authUser?.email || 'Agente';
  const prefix = payload.origem === 'workflow' ? 'WF' : 'Responsavel';
  const entry: IChamadoWorkflowComunicacao = {
    mensagem: texto,
    data: new Date(),
    autor: `${prefix}: ${nome}`,
  };

  requisicao.comunicacaoWorkflow = [...(requisicao.comunicacaoWorkflow || []), entry];
  chamado.markModified('workflow');
  chamado.markModified('workflow.requisicao');
  chamado.markModified('workflow.requisicao.comunicacaoWorkflow');

  appendRegistroEntry(chamado, {
    anotacaoInterna: `[Workflow] ${prefix}: ${texto}`,
    autor: nome,
    metadados: {
      comunicacaoWorkflow: {
        origem: payload.origem,
        mensagem: texto,
        autor: entry.autor,
      },
    },
  });

  return entry;
}
