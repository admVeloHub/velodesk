/**
 * ticketMergeService v1.0.0 — mesclagem de ticket duplicado no Client360
 */
import { ticketsApi } from '../../api/client';
import { apiTicketToCockpit } from '../../api/adapters/ticketAdapter';
import { getAgentName } from '../clientDb';
import {
  applySendStatus,
  buildTicketMergeNote,
  copyTabulationFromTicket,
  isTicketAlreadyMergedSource,
  isTicketMergeTargetEligible,
  isTicketTerminalStatus,
} from './utils';
import { findTicketEntry, updateTicketInCache } from '../ticketsStorage';
import { isApiMode, isDraftTicket, loadBoxesFromApi } from '../ticketsCache';

export class TicketMergeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TicketMergeValidationError';
  }
}

function assertMergePair(sourceId, targetId) {
  if (String(sourceId) === String(targetId)) {
    throw new TicketMergeValidationError('Não é possível mesclar um ticket com ele mesmo.');
  }

  const sourceEntry = findTicketEntry(sourceId);
  const targetEntry = findTicketEntry(targetId);
  if (!sourceEntry?.ticket || !targetEntry?.ticket) {
    throw new TicketMergeValidationError('Ticket não encontrado.');
  }

  if (isDraftTicket(sourceEntry.ticket)) {
    throw new TicketMergeValidationError('Salve o ticket antes de mesclar.');
  }

  if (isTicketAlreadyMergedSource(sourceEntry.ticket)) {
    throw new TicketMergeValidationError('Este ticket já foi mesclado anteriormente.');
  }

  if (!isTicketMergeTargetEligible(sourceEntry.ticket, targetEntry.ticket)) {
    if (isTicketTerminalStatus(targetEntry.ticket)) {
      throw new TicketMergeValidationError('Selecione um chamado em andamento como destino.');
    }
    throw new TicketMergeValidationError('Este ticket não pode ser usado como destino da mesclagem.');
  }

  return { sourceEntry, targetEntry };
}

async function mergeTicketIntoLocal(sourceId, targetId) {
  const { sourceEntry, targetEntry } = assertMergePair(sourceId, targetId);
  const sourceTicket = sourceEntry.ticket;
  const targetTicket = targetEntry.ticket;
  const mergeNote = buildTicketMergeNote(sourceTicket, targetTicket);
  const ts = new Date().toISOString();
  const author = getAgentName() || 'Agente';
  const targetIdStr = String(targetTicket.id || targetTicket._id);

  await updateTicketInCache(sourceId, (t) => {
    const copied = copyTabulationFromTicket(t, targetTicket);
    Object.assign(t, copied);
    if (!t.lateralForm) t.lateralForm = {};
    Object.assign(t.lateralForm, copied.lateralForm);
    t.lateralForm.mergedIntoTicketId = targetIdStr;

    if (!t.internalNotes) t.internalNotes = [];
    t.internalNotes.push({
      id: `merge-${Date.now()}-source`,
      type: 'internal',
      origin: 'agente',
      text: mergeNote,
      timestamp: ts,
      author,
    });

    if (!t.registroHistorico) t.registroHistorico = [];
    t.registroHistorico.push({
      id: `merge-reg-${Date.now()}-source`,
      origin: 'agente',
      autor: author,
      anotacaoInterna: mergeNote,
      timestamp: ts,
      time: ts,
      status: 'resolvido',
      metadados: {
        merge: {
          role: 'source',
          targetId: targetIdStr,
          targetProtocol: targetTicket.chamadoProtocolo || targetIdStr,
        },
      },
    });

    applySendStatus({ ticket: t, boxId: sourceEntry.boxId }, 'resolvidos');
    t.updatedAt = ts;
    return t;
  });

  await updateTicketInCache(targetId, (t) => {
    if (!t.internalNotes) t.internalNotes = [];
    t.internalNotes.push({
      id: `merge-${Date.now()}-target`,
      type: 'internal',
      origin: 'agente',
      text: mergeNote,
      timestamp: ts,
      author,
    });

    if (!t.registroHistorico) t.registroHistorico = [];
    t.registroHistorico.push({
      id: `merge-reg-${Date.now()}-target`,
      origin: 'agente',
      autor: author,
      anotacaoInterna: mergeNote,
      timestamp: ts,
      time: ts,
      status: t.status || 'em-aberto',
      metadados: {
        merge: {
          role: 'target',
          sourceId: String(sourceTicket.id || sourceTicket._id),
          sourceProtocol: sourceTicket.chamadoProtocolo || sourceId,
        },
      },
    });

    t.updatedAt = ts;
    return t;
  });

  const updatedTarget = findTicketEntry(targetId)?.ticket || targetTicket;
  const updatedSource = findTicketEntry(sourceId)?.ticket;
  return {
    source: updatedSource ? apiTicketToCockpit(updatedSource) : null,
    target: apiTicketToCockpit(updatedTarget),
  };
}

export async function mergeTicketInto(sourceId, targetId) {
  assertMergePair(sourceId, targetId);

  if (isApiMode() && localStorage.getItem('velodesk_token')) {
    const result = await ticketsApi.mergeInto(sourceId, targetId);
    await loadBoxesFromApi();
    return {
      source: apiTicketToCockpit(result.source),
      target: apiTicketToCockpit(result.target),
    };
  }

  return mergeTicketIntoLocal(sourceId, targetId);
}

export function canSelectTicketForMerge(sourceTicket, candidateTicket, sourceTicketId, context = {}) {
  if (!sourceTicket || !candidateTicket) return false;
  const candidateId = String(candidateTicket.id || candidateTicket._id);
  if (candidateId === String(sourceTicketId)) return false;
  return isTicketMergeTargetEligible(sourceTicket, candidateTicket, context);
}
