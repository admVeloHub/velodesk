/**
 * especiaisTicketCommitService — Salvar vs Finalizar tickets dos 4 canais especiais
 */
import { cockpitTicketToApi } from '../../../api/adapters/ticketAdapter';
import { getAgentName } from '../../../services/clientDb';
import { htmlToPlainText } from '../../../services/desk/composeRichEditor';
import { isTicketReadOnly } from '../../../services/desk/utils';
import { RA_STATUS } from '../../../services/especiais/reclameAquiData';
import { PC_STATUS } from '../../../services/especiais/proconData';
import { CG_STATUS } from '../../../services/especiais/consumidorGovData';
import { BC_STATUS } from '../../../services/especiais/bacenData';
import {
  getReclamacaoByTicketId,
  patchReclamacao,
  updateReclamacaoGroupFromTicket,
} from '../../../services/especiais/reclameAquiStore';
import {
  getDemandaByTicketId as getProconByTicketId,
  patchDemanda as patchProconDemanda,
  updateDemandaGroupFromTicket as updateProconGroupFromTicket,
} from '../../../services/especiais/proconStore';
import {
  getDemandaByTicketId as getGovByTicketId,
  patchDemanda as patchGovDemanda,
  updateDemandaGroupFromTicket as updateGovGroupFromTicket,
} from '../../../services/especiais/consumidorGovStore';
import {
  getDemandaByTicketId as getBacenByTicketId,
  patchDemanda as patchBacenDemanda,
  updateDemandaGroupFromTicket as updateBacenGroupFromTicket,
} from '../../../services/especiais/bacenStore';
import { syncEspeciaisGroupFromTicket } from '../../../services/especiais/especiaisTicketGroupSync';
import { commitTicketViaApi, loadTicketDetailFromApi } from '../../../services/ticketsCache';

const CHANNEL_CONFIG = {
  ra: {
    metaKey: 'reclameAqui',
    statusField: 'statusRa',
    respondidaStatus: RA_STATUS.RESPONDIDA,
    getByTicketId: getReclamacaoByTicketId,
    patchItem: patchReclamacao,
    updateGroupFromTicket: updateReclamacaoGroupFromTicket,
  },
  pc: {
    metaKey: 'procon',
    statusField: 'statusPc',
    respondidaStatus: PC_STATUS.RESPONDIDA,
    getByTicketId: getProconByTicketId,
    patchItem: patchProconDemanda,
    updateGroupFromTicket: updateProconGroupFromTicket,
  },
  gov: {
    metaKey: 'consumidorGov',
    statusField: 'statusGov',
    respondidaStatus: CG_STATUS.RESPONDIDA,
    getByTicketId: getGovByTicketId,
    patchItem: patchGovDemanda,
    updateGroupFromTicket: updateGovGroupFromTicket,
  },
  bc: {
    metaKey: 'bacen',
    statusField: 'statusBc',
    respondidaStatus: BC_STATUS.RESPONDIDA,
    getByTicketId: getBacenByTicketId,
    patchItem: patchBacenDemanda,
    updateGroupFromTicket: updateBacenGroupFromTicket,
  },
};

function resolveTargetStatus(ticket, finalize, hasPublicPayload) {
  const currentStatus = String(ticket?.status || 'novo').trim().toLowerCase();
  if (finalize) return 'resolvido';
  if (hasPublicPayload && (currentStatus === 'novo' || !currentStatus)) {
    return 'em-andamento';
  }
  return currentStatus || 'em-andamento';
}

export function buildEspeciaisCommitPayload(ticket, session, { finalize = false, channelId = 'ra' } = {}) {
  const config = CHANNEL_CONFIG[channelId] || CHANNEL_CONFIG.ra;
  const messageHtml = String(session?.composeText || '').trim();
  const internalNoteHtml = String(session?.internalText || '').trim();
  const messageText = htmlToPlainText(messageHtml).trim();
  const internalNoteText = htmlToPlainText(internalNoteHtml).trim();
  const attachmentUrls = (session?.composeAttachments || [])
    .map((item) => String(item?.url || '').trim())
    .filter(Boolean);
  const hasPublicPayload = Boolean(messageText || attachmentUrls.length);
  const targetStatus = resolveTargetStatus(ticket, finalize, hasPublicPayload);

  const prepared = { ...ticket, status: targetStatus };
  const lf = { ...(prepared.lateralForm || {}) };
  const existingMeta = lf[config.metaKey] && typeof lf[config.metaKey] === 'object'
    ? lf[config.metaKey]
    : {};

  if (finalize) {
    lf[config.metaKey] = {
      ...existingMeta,
      [config.statusField]: config.respondidaStatus,
    };
  }
  prepared.lateralForm = lf;

  const base = cockpitTicketToApi(prepared);
  const apiLf = { ...(base.lateralForm || {}) };
  if (finalize) {
    apiLf[config.metaKey] = {
      ...(apiLf[config.metaKey] && typeof apiLf[config.metaKey] === 'object' ? apiLf[config.metaKey] : {}),
      [config.statusField]: config.respondidaStatus,
    };
  }

  return {
    payload: {
      ...base,
      status: targetStatus,
      text: messageHtml || '',
      internalText: internalNoteHtml || '',
      author: getAgentName(),
      lateralForm: apiLf,
      ...(attachmentUrls.length ? { attachments: attachmentUrls } : {}),
    },
    hadPublicPayload: hasPublicPayload,
    hadInternalPayload: Boolean(internalNoteText),
  };
}

function mergeChannelItemMeta(channelItem, ticket, config) {
  if (!channelItem || !ticket) return channelItem;
  const apiMeta = ticket.lateralForm?.[config.metaKey];
  if (!apiMeta || typeof apiMeta !== 'object') return channelItem;
  return {
    ...channelItem,
    ...apiMeta,
    ticketId: channelItem.ticketId || String(ticket.id || ticket._id || ''),
    chamadoProtocolo: ticket.chamadoProtocolo || channelItem.chamadoProtocolo,
  };
}

export async function commitEspeciaisTicket({
  channelId,
  ticket,
  channelItem,
  session,
  finalize = false,
}) {
  if (!ticket) {
    throw new Error('Ticket inválido.');
  }
  if (isTicketReadOnly(ticket)) {
    throw new Error('Ticket fechado — não aceita modificações.');
  }

  const config = CHANNEL_CONFIG[channelId] || CHANNEL_CONFIG.ra;
  const ticketId = String(ticket.id || ticket._id || '');
  if (!ticketId) {
    throw new Error('Ticket inválido.');
  }

  const { payload, hadPublicPayload, hadInternalPayload } = buildEspeciaisCommitPayload(
    ticket,
    session,
    { finalize, channelId },
  );

  await commitTicketViaApi(ticketId, payload);
  let updatedTicket = await loadTicketDetailFromApi(ticketId);
  if (!updatedTicket) {
    updatedTicket = { ...ticket, status: payload.status };
  }

  let updatedChannelItem = channelItem;
  if (finalize && channelItem) {
    updatedChannelItem = config.patchItem({
      ...channelItem,
      [config.statusField]: config.respondidaStatus,
      aberta: false,
    });
  }

  const synced = config.updateGroupFromTicket(updatedTicket);
  if (synced) {
    updatedChannelItem = synced;
  } else if (!updatedChannelItem) {
    updatedChannelItem = config.getByTicketId(ticketId);
  }

  syncEspeciaisGroupFromTicket(updatedTicket);
  updatedChannelItem = mergeChannelItemMeta(updatedChannelItem, updatedTicket, config);

  return {
    ticket: updatedTicket,
    channelItem: updatedChannelItem,
    hadPublicPayload,
    hadInternalPayload,
  };
}

export { CHANNEL_CONFIG };
