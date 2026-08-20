/**
 * workflowDecisionHandlers v2.5.0 — approve Produtos: msg no BE; reject mantém WF ativo
 * VERSION: v2.5.0 | DATE: 2026-08-20
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import {
  findTicketEntry,
  loadTicketDetailFromApi,
  patchTicketInCache,
  updateTicketInCache,
} from '../ticketsStorage';
import {
  applySendStatus,
  getAgentName,
  getTicketProtocolLabel,
  getWorkflowProgress,
} from '../desk/utils';
import { markSolicitacaoFeita } from '../cadastral/cadastralRequestStore';
import { createWorkflowInfoRequest } from './workflowInfoNotifications';
import deskLog from '../../utils/deskDebugLog';

async function persistTicketFromApi(ticketId, apiTicket) {
  const full = apiTicketToCockpit(apiTicket);
  full.listOnly = false;
  full._detailLoaded = true;
  const patched = patchTicketInCache(ticketId, full);
  if (!patched) {
    deskLog.warn('WORKFLOW', 'patchTicketInCache falhou — ticket fora das colunas', { ticketId });
  }
  return full;
}

export async function approveWorkflowDecision(ticketId, options = {}) {
  deskLog.workflow('approve → API', { ticketId, options });
  const apiTicket = await ticketsApi.advanceWorkflow(ticketId, { decision: 'approve' });
  const ticket = await persistTicketFromApi(ticketId, apiTicket);

  // A API omite `workflow` inteiro quando o backend o marca como inativo (concluído),
  // então `completedAt` nunca vem preenchido — `workflow.active` é o único sinal confiável
  // de que o workflow ainda tem etapas pendentes (ex.: "Retorno ao cliente" após produtos).
  const stillActive = Boolean(apiTicket?.workflow?.active);
  let finalTicket = ticket;

  if (!stillActive) {
    const completedAt = apiTicket?.workflow?.completedAt
      || apiTicket?.lateralForm?.workflow?.completedAt
      || new Date().toISOString();

    finalTicket = (await updateTicketInCache(ticketId, (t) => {
      if (!t) return t;
      const next = { ...t };
      const workflow = next.workflow || {};
      const lateralWorkflow = next.lateralForm?.workflow || {};
      next.workflow = {
        ...workflow,
        active: false,
        completedAt,
        status: 'completed',
        stepHistory: workflow.stepHistory || lateralWorkflow.stepHistory || [],
      };
      next.lateralForm = {
        ...next.lateralForm,
        workflow: {
          ...lateralWorkflow,
          active: false,
          completedAt,
          status: 'completed',
          stepHistory: lateralWorkflow.stepHistory || workflow.stepHistory || [],
        },
      };
      next.status = 'resolvido';
      return next;
    })) || finalTicket;
  }

  // "Feito" do time de produtos sempre encerra o workflow (ver advanceWorkflowProdutosQueueDecision
  // no backend) — quando realmente concluído, notifica o cliente e move o ticket para Resolvido.
  const isProdutosFinalize = options.finalizeProdutos === true && !stillActive;
  if (!isProdutosFinalize || !finalTicket) return finalTicket;

  // Mensagem pública enviada pelo backend (advanceWorkflowProdutosQueueDecision).
  const entry = findTicketEntry(ticketId);
  if (entry) {
    applySendStatus(entry, 'resolvidos');
    await updateTicketInCache(ticketId, (t) => {
      t.status = 'resolvido';
      return t;
    });
  }

  const solic = finalTicket.lateralForm?.solicitacaoProdutos;
  if (solic?.id) {
    markSolicitacaoFeita(solic.id);
  }

  return finalTicket;
}

export async function rejectWorkflowDecision(ticketId) {
  deskLog.workflow('reject → API', { ticketId });
  const apiTicket = await ticketsApi.advanceWorkflow(ticketId, { decision: 'reject' });
  const ticket = await persistTicketFromApi(ticketId, apiTicket);

  // Reprovar só conclui o workflow quando o ticket já estava encerrado pelo agente
  // responsável (ver advanceWorkflowProdutosQueueDecision no backend) — nesse caso o
  // status do ticket permanece o que o agente definiu (resolvido/cancelado/fechado).
  const stillActive = Boolean(apiTicket?.workflow?.active);
  if (stillActive) {
    return (await updateTicketInCache(ticketId, (t) => {
      if (!t) return t;
      const next = { ...t };
      next.status = apiTicket?.status || 'em-andamento';
      if (next.workflow) {
        next.workflow = { ...next.workflow, active: true, status: 'active' };
      }
      if (next.lateralForm?.workflow) {
        next.lateralForm = {
          ...next.lateralForm,
          workflow: {
            ...next.lateralForm.workflow,
            active: true,
            status: 'active',
            stepHistory: apiTicket?.lateralForm?.workflow?.stepHistory
              || apiTicket?.workflow?.stepHistory
              || next.lateralForm.workflow.stepHistory,
          },
        };
      }
      return next;
    })) || ticket;
  }

  const completedAt = apiTicket?.workflow?.completedAt
    || apiTicket?.lateralForm?.workflow?.completedAt
    || new Date().toISOString();

  return (await updateTicketInCache(ticketId, (t) => {
    if (!t) return t;
    const next = { ...t };
    const workflow = next.workflow || {};
    const lateralWorkflow = next.lateralForm?.workflow || {};
    next.workflow = {
      ...workflow,
      active: false,
      completedAt,
      status: 'completed',
      stepHistory: workflow.stepHistory || lateralWorkflow.stepHistory || [],
    };
    next.lateralForm = {
      ...next.lateralForm,
      workflow: {
        ...lateralWorkflow,
        active: false,
        completedAt,
        status: 'completed',
        stepHistory: lateralWorkflow.stepHistory || workflow.stepHistory || [],
      },
    };
    return next;
  })) || ticket;
}

export async function requestWorkflowInfo(ticketId, message = '', origem = 'workflow') {
  const texto = String(message || '').trim();
  if (!texto) throw new Error('Mensagem obrigatória');
  deskLog.workflow('comunicacao → API', { ticketId, origem });
  const prevEntry = findTicketEntry(ticketId);
  const prevTicket = prevEntry?.ticket;
  const apiTicket = await ticketsApi.postWorkflowComunicacao(ticketId, {
    mensagem: texto,
    origem,
  });
  const full = await persistTicketFromApi(ticketId, apiTicket);
  if (
    origem === 'workflow'
    && full?.workflow?.requisicao?.comunicacaoPendente === true
  ) {
    const progress = getWorkflowProgress(full);
    createWorkflowInfoRequest({
      ticketId: String(ticketId),
      clientName: full.clientName || prevTicket?.clientName || 'Cliente',
      ticketSubject: full.title || prevTicket?.title || '',
      message: texto,
      requestedBy: getAgentName() || 'Operador Workflow',
      targetAgent: full.responsibleAgent || full.lateralForm?.responsavel || prevTicket?.lateralForm?.responsavel || '',
      stepLabel: progress?.activeStep?.passo?.nome || progress?.activeStep?.nome || 'Aprovação',
      protocol: getTicketProtocolLabel(full) || getTicketProtocolLabel(prevTicket) || '',
    });
    try {
      window.dispatchEvent(new CustomEvent('velodesk:workflow-info-changed'));
    } catch {
      /* ignore */
    }
  }
  deskLog.workflow('comunicacao → ok', {
    ticketId,
    mensagens: full?.workflow?.requisicao?.comunicacaoWorkflow?.length || 0,
  });
  return full;
}

export async function replyWorkflowComunicacao(ticketId, message = '') {
  return requestWorkflowInfo(ticketId, message, 'responsavel');
}

function readAutorOrigem(autor) {
  const normalized = String(autor || '').trim().toLowerCase();
  if (normalized.startsWith('responsavel:')) return 'responsavel';
  if (normalized.startsWith('wf:')) return 'workflow';
  return null;
}

function buildComunicacaoResumoFromThread(thread = []) {
  if (!thread.length) {
    return { ultimaOrigem: null, ultimaData: null, temRespostaAgente: false };
  }
  const temRespostaAgente = thread.some(
    (item) => readAutorOrigem(item.autor) === 'responsavel',
  );
  const last = thread[thread.length - 1];
  return {
    ultimaOrigem: readAutorOrigem(last.autor),
    ultimaData: last.data || null,
    temRespostaAgente,
  };
}

export function resolveComunicacaoResumo(ticket) {
  const fromApi = ticket?.workflow?.requisicao?.comunicacaoResumo;
  if (fromApi && fromApi.ultimaOrigem !== undefined) {
    return {
      ultimaOrigem: fromApi.ultimaOrigem || null,
      ultimaData: fromApi.ultimaData || null,
      temRespostaAgente: fromApi.temRespostaAgente === true,
    };
  }
  return buildComunicacaoResumoFromThread(readTicketComunicacaoWorkflow(ticket));
}

export function ticketAwaitingProdutosComunicacaoReview(ticket) {
  if (!ticket?.workflow?.active) return false;
  if (ticket.workflow?.completedAt) return false;
  const lfStatus = ticket?.lateralForm?.workflow?.status;
  if (lfStatus === 'completed') return false;
  return resolveComunicacaoResumo(ticket).ultimaOrigem === 'responsavel';
}

function readComunicacaoFromRegistro(ticket) {
  const rows = ticket?.registroHistorico || ticket?.registro || [];
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows
    .map((row) => row?.metadados?.comunicacaoWorkflow)
    .filter((item) => item && String(item.mensagem || '').trim())
    .map((item, index) => ({
      mensagem: String(item.mensagem || ''),
      autor: String(item.autor || ''),
      data: rows.find((r) => r?.metadados?.comunicacaoWorkflow === item)?.data
        || rows[index]?.data
        || null,
    }));
}

export function readTicketComunicacaoWorkflow(ticket) {
  const list = ticket?.workflow?.requisicao?.comunicacaoWorkflow
    || ticket?.lateralForm?.workflow?.requisicao?.comunicacaoWorkflow
    || [];
  if (Array.isArray(list) && list.length) return list;
  return readComunicacaoFromRegistro(ticket);
}

export function ticketHasComunicacaoWorkflow(ticket) {
  if (ticket?.workflow?.requisicao?.comunicacaoPendente === true) return true;
  return readTicketComunicacaoWorkflow(ticket).length > 0;
}

/** Busca detalhe completo e devolve a thread (fonte da verdade no modal). */
export async function loadComunicacaoWorkflowForTicket(ticketId) {
  const full = await loadTicketDetailFromApi(ticketId);
  const thread = readTicketComunicacaoWorkflow(full);
  deskLog.workflow('comunicacao thread hidratada', {
    ticketId,
    mensagens: thread.length,
  });
  return { ticket: full, thread };
}
