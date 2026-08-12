/**
 * ticketThreadSync v1.5.0 — refresh IA considera fingerprint WhatsApp persistido
 * VERSION: v1.5.0 | DATE: 2026-08-12
 */

function normalizeMsgText(value) {
  return String(value || '').trim();
}

function publicMessagesFromTicket(ticket) {
  return (ticket?.messages || []).filter((m) => {
    if (!m || m.type === 'internal') return false;
    return Boolean(normalizeMsgText(m.text || m.message)) || (m.attachments?.length > 0);
  });
}

/** Fingerprint da thread pública persistida (polling / merge). */
export function buildPublicThreadFingerprint(ticket) {
  if (!ticket) return '';
  return publicMessagesFromTicket(ticket)
    .map((m) => {
      const ts = m.timestamp || m.time || m.createdAt || '';
      const text = normalizeMsgText(m.text || m.message);
      const att = Array.isArray(m.attachments) ? m.attachments.length : 0;
      return `${m.id || ''}|${m.type || ''}|${ts}|${text}|${att}`;
    })
    .join(';;');
}

/** Fingerprint só das mensagens do cliente na thread renderizada. */
export function buildClientThreadFingerprint(convMsgs) {
  return (convMsgs || [])
    .filter((m) => m?.type === 'client')
    .map((m) => {
      const ts = m.timestamp || '';
      const text = normalizeMsgText(m.text);
      const att = Array.isArray(m.attachments) ? m.attachments.length : 0;
      return `${ts}|${text}|${att}`;
    })
    .join(';;');
}

/** Notas internas persistidas no ticket (sem rascunho local do compose). */
export function buildPersistedInternalNotesFingerprint(ticket) {
  if (!ticket) return '';
  const parts = [];

  (ticket.internalNotes || []).forEach((note) => {
    const text = normalizeMsgText(note.text || note.message);
    if (!text) return;
    const ts = note.timestamp || note.time || '';
    parts.push(`${ts}|${text}`);
  });

  (ticket.registroHistorico || ticket.registroAlteracoes || []).forEach((entry) => {
    const text = normalizeMsgText(entry.anotacaoInterna);
    if (!text) return;
    const ts = entry.time || entry.timestamp || '';
    parts.push(`${ts}|${text}`);
  });

  return parts.join(';;');
}

export function hasPublicThreadChanged(prevTicket, nextTicket) {
  if (!prevTicket && !nextTicket) return false;
  if (!prevTicket || !nextTicket) return true;
  return buildPublicThreadFingerprint(prevTicket) !== buildPublicThreadFingerprint(nextTicket);
}

function whatsAppMessagesFromTicket(ticket) {
  return (ticket?.messages || []).filter((m) => {
    if (!m || m.type === 'internal') return false;
    if (m.channel === 'whatsapp') return true;
    const metaSource = String(m.source || m.metadados?.source || '').toLowerCase();
    return metaSource === 'whatsapp-thread';
  });
}

/** Fingerprint das mensagens WhatsApp persistidas (channel whatsapp / whatsapp-thread). */
export function buildWhatsAppThreadFingerprint(ticket) {
  return whatsAppMessagesFromTicket(ticket)
    .map((m) => {
      const ts = m.timestamp || m.time || m.createdAt || '';
      const text = normalizeMsgText(m.text || m.message);
      const origin = m.origin || (m.sender === 'them' ? 'cliente' : 'agente');
      const attachments = Array.isArray(m.attachments) ? m.attachments.join(',') : '';
      const transcription = String(m.transcriptionStatus || '');
      return `${m.id || ''}|${origin}|${ts}|${text}|${attachments}|${transcription}`;
    })
    .join(';;');
}

export function hasWhatsAppThreadChanged(prevTicket, nextTicket) {
  if (!prevTicket && !nextTicket) return false;
  if (!prevTicket || !nextTicket) return true;
  return buildWhatsAppThreadFingerprint(prevTicket) !== buildWhatsAppThreadFingerprint(nextTicket);
}

/** Dispara refresh da sugestão IA (e-mail/chat: nova msg cliente; telefone: notas persistidas). */
export function buildAiSuggestionRefreshKey({
  ticketId,
  contextSource,
  isPhone,
  convMsgs,
  ticket,
}) {
  const id = String(ticketId || '');
  if (isPhone) {
    return [
      id,
      contextSource,
      'phone',
      buildPersistedInternalNotesFingerprint(ticket),
    ].join('::');
  }
  return [
    id,
    contextSource,
    'client',
    buildClientThreadFingerprint(convMsgs),
    buildWhatsAppThreadFingerprint(ticket),
  ].join('::');
}

/** Última mensagem pública cliente/agente na thread renderizada (ignora sistema). */
export function getLastClientOrAgentConvMsg(convMsgs) {
  for (let i = (convMsgs || []).length - 1; i >= 0; i -= 1) {
    const m = convMsgs[i];
    if (m?.type === 'client' || m?.type === 'agent') return m;
  }
  return null;
}

export function isLastPublicInteractionFromAgent(convMsgs) {
  let lastClient = null;
  let lastAgent = null;
  for (const m of convMsgs || []) {
    if (m?.type === 'client') lastClient = m;
    if (m?.type === 'agent') lastAgent = m;
  }
  if (!lastClient) return false;
  if (!lastAgent) return false;
  const tsClient = new Date(lastClient.timestamp || 0).getTime();
  const tsAgent = new Date(lastAgent.timestamp || 0).getTime();
  if (Number.isNaN(tsClient) || Number.isNaN(tsAgent)) {
    return getLastClientOrAgentConvMsg(convMsgs)?.type === 'agent';
  }
  return tsAgent > tsClient;
}
