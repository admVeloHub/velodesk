/** workflowRequisicao.service v1.3.0 — bloqueia comunicação se workflow cancel/finished */
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
import { appendRegistroEntry, currentStatus, normalizeStatusValue } from './chamado.mapper';
import { isWorkflowOperable } from './workflowStatus.util';

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
  previous?: IChamadoWorkflowComunicacaoResumo | null,
): IChamadoWorkflowComunicacaoResumo {
  // vistoResponsavelEm nunca é recalculado a partir da thread — só muda via
  // markComunicacaoWorkflowVisto (ticket aberto pelo lado workflow). Preservar aqui evita
  // que cada nova mensagem "reabra" o badge indevidamente antes da hora.
  const vistoResponsavelEm = previous?.vistoResponsavelEm ?? null;

  if (!thread.length) {
    return {
      ultimaOrigem: null,
      ultimaData: null,
      temRespostaAgente: false,
      ultimoWorkflowAutorEmail: previous?.ultimoWorkflowAutorEmail || '',
      vistoResponsavelEm,
    };
  }
  const temRespostaAgente = thread.some(
    (item) => readAutorOrigem(item.autor) === 'responsavel',
  );
  const lastWorkflowEntry = [...thread].reverse().find(
    (item) => readAutorOrigem(item.autor) === 'workflow',
  );
  const last = thread[thread.length - 1];
  return {
    ultimaOrigem: readAutorOrigem(last.autor),
    ultimaData: last.data ? new Date(last.data) : null,
    temRespostaAgente,
    // Só o e-mail de quem mandou como "workflow" — usado pra notificar de volta quando o
    // agente responde. Cai no valor anterior se essa mensagem não tiver e-mail capturado
    // (dados antigos) ao invés de apagar quem já estava marcado como destinatário.
    ultimoWorkflowAutorEmail: lastWorkflowEntry?.autorEmail || previous?.ultimoWorkflowAutorEmail || '',
    vistoResponsavelEm,
  };
}

/** Ticket aberto pelo lado workflow após resposta do agente — esconde o badge "Aguardando
 * resposta" na fila de aprovação sem exigir que uma nova mensagem seja enviada. */
export function markComunicacaoWorkflowVisto(chamado: IChamadoN1): boolean {
  const requisicao = chamado.workflow?.requisicao;
  if (!requisicao?.comunicacaoResumo) return false;
  if (requisicao.comunicacaoResumo.ultimaOrigem !== 'responsavel') return false;

  requisicao.comunicacaoResumo.vistoResponsavelEm = new Date();
  chamado.markModified('workflow.requisicao.comunicacaoResumo');
  return true;
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

  if (!isWorkflowOperable(chamado.workflow, normalizeStatusValue(currentStatus(chamado)))) {
    throw new WorkflowRequisicaoError('Workflow encerrado — comunicação não é mais possível', 400);
  }
  const requisicao = ensureRequisicaoShell(chamado);
  const nome = authUser?.name || authUser?.email || 'Agente';
  const prefix = payload.origem === 'workflow' ? 'WF' : 'Responsavel';
  const entry: IChamadoWorkflowComunicacao = {
    mensagem: texto,
    data: new Date(),
    autor: `${prefix}: ${nome}`,
    autorEmail: String(authUser?.email || '').trim().toLowerCase(),
  };

  requisicao.comunicacaoWorkflow = [...(requisicao.comunicacaoWorkflow || []), entry];
  requisicao.comunicacaoResumo = buildComunicacaoResumo(requisicao.comunicacaoWorkflow, requisicao.comunicacaoResumo);
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
