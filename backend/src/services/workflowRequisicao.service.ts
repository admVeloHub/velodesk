/** workflowRequisicao.service v1.2.0 — markModified ao append comunicacaoWorkflow */
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1 } from '../models/ChamadoN1';
import type { IWorkflowDefinicao } from '../models/WorkflowDefinicao';
import {
  type ComunicacaoWorkflowOrigem,
  type IChamadoWorkflowComunicacao,
  type IChamadoWorkflowComunicacaoResumo,
  type IChamadoWorkflowRequisicao,
  normalizeRequisicaoConfig,
  validateRequisicaoValores,
  WorkflowRequisicaoError,
} from '../config/workflowRequisicaoDefaults';
import { appendRegistroEntry } from './chamado.mapper';

export { WorkflowRequisicaoError };

export type ComunicacaoOrigem = ComunicacaoWorkflowOrigem;

function readAutorOrigem(autor: string): ComunicacaoWorkflowOrigem | null {
  const normalized = String(autor || '').trim().toLowerCase();
  if (normalized.startsWith('responsavel:')) return 'responsavel';
  if (normalized.startsWith('wf:')) return 'workflow';
  return null;
}

export function buildComunicacaoResumo(
  thread: IChamadoWorkflowComunicacao[] = [],
): IChamadoWorkflowComunicacaoResumo {
  if (!thread.length) {
    return { ultimaOrigem: null, ultimaData: null, temRespostaAgente: false };
  }
  const temRespostaAgente = thread.some(
    (item) => readAutorOrigem(item.autor) === 'responsavel',
  );
  const last = thread[thread.length - 1];
  return {
    ultimaOrigem: readAutorOrigem(last.autor),
    ultimaData: last.data ? new Date(last.data) : null,
    temRespostaAgente,
  };
}

export function getRequisicaoConfig(definicao: IWorkflowDefinicao) {
  return normalizeRequisicaoConfig(definicao.requisicao, definicao.gatilho);
}

export function buildRequisicaoSnapshot(
  definicao: IWorkflowDefinicao,
  valores: Record<string, unknown> | undefined,
  authUser?: AuthPayload | null,
  solicitacaoProdutos?: Record<string, unknown>,
): IChamadoWorkflowRequisicao | null {
  const config = getRequisicaoConfig(definicao);
  const hasSolicitacao = Boolean(
    solicitacaoProdutos && Object.keys(solicitacaoProdutos).length,
  );

  if (!config.campos.length && !hasSolicitacao) return null;

  let snapshot: IChamadoWorkflowRequisicao;

  if (config.campos.length) {
    const parsed = validateRequisicaoValores(config, valores || {});
    if (!parsed.ok) {
      throw new WorkflowRequisicaoError(parsed.message, 400);
    }
    snapshot = {
      preenchidaEm: new Date(),
      preenchidaPor: authUser?.name || authUser?.email || 'Agente',
      valores: parsed.valores,
      comunicacaoWorkflow: [],
    };
  } else {
    snapshot = {
      preenchidaEm: new Date(),
      preenchidaPor: authUser?.name || authUser?.email || 'Agente',
      valores: {},
      comunicacaoWorkflow: [],
    };
  }

  if (hasSolicitacao) {
    snapshot.solicitacaoProdutos = solicitacaoProdutos;
  }

  return snapshot;
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
  requisicao.comunicacaoResumo = buildComunicacaoResumo(requisicao.comunicacaoWorkflow);
  chamado.markModified('workflow');
  chamado.markModified('workflow.requisicao');
  chamado.markModified('workflow.requisicao.comunicacaoWorkflow');
  chamado.markModified('workflow.requisicao.comunicacaoResumo');

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
