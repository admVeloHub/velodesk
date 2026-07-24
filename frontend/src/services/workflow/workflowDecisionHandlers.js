/**
 * workflowDecisionHandlers v2.2.0 — loadComunicacaoWorkflowForTicket (GET detalhe)
 * VERSION: v2.2.0 | DATE: 2026-07-24
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import {
  findTicketEntry,
  loadTicketDetailFromApi,
  patchTicketInCache,
  sendTicketMessage,
  updateTicketInCache,
} from '../ticketsStorage';
import {
  applySendStatus,
  getAgentName,
} from '../desk/utils';
import {
  buildProdutosConclusaoClientMessage,
} from '../cadastral/solicitacoesProdutosData';
import { markSolicitacaoFeita } from '../cadastral/cadastralRequestStore';
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

  const isProdutosFinalize = Boolean(options.selectedActions?.length);
  if (!isProdutosFinalize || !ticket) return ticket;

  const clientText = buildProdutosConclusaoClientMessage(ticket);
  await sendTicketMessage(ticketId, clientText, getAgentName() || 'Operador Produtos');

  const entry = findTicketEntry(ticketId);
  if (entry) {
    applySendStatus(entry, 'resolvidos');
    await updateTicketInCache(ticketId, (t) => {
      t.status = 'resolvido';
      return t;
    });
  }

  const solic = ticket.lateralForm?.solicitacaoProdutos;
  if (solic?.id) {
    markSolicitacaoFeita(solic.id);
  }

  return ticket;
}

export async function rejectWorkflowDecision(ticketId) {
  deskLog.workflow('reject → API', { ticketId });
  const apiTicket = await ticketsApi.advanceWorkflow(ticketId, { decision: 'reject' });
  return persistTicketFromApi(ticketId, apiTicket);
}

export async function requestWorkflowInfo(ticketId, message = '', origem = 'workflow') {
  const texto = String(message || '').trim();
  if (!texto) throw new Error('Mensagem obrigatória');
  deskLog.workflow('comunicacao → API', { ticketId, origem });
  const apiTicket = await ticketsApi.postWorkflowComunicacao(ticketId, {
    mensagem: texto,
    origem,
  });
  const full = await persistTicketFromApi(ticketId, apiTicket);
  deskLog.workflow('comunicacao → ok', {
    ticketId,
    mensagens: full?.workflow?.requisicao?.comunicacaoWorkflow?.length || 0,
  });
  return full;
}

export async function replyWorkflowComunicacao(ticketId, message = '') {
  return requestWorkflowInfo(ticketId, message, 'responsavel');
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
