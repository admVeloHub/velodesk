/**
 * ticketThreadSync v1.9.1 — fingerprint de notas usa texto plano (sem HTML)
 * VERSION: v1.9.1 | DATE: 2026-08-20
 */

function normalizeMsgText(value) {
  return String(value || '').trim();
}

/** Instantâneo comparável — Date, ISO e locale string viram o mesmo epoch. */
function fingerprintTime(value) {
  if (value == null || value === '') return '';
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? String(t) : String(value);
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
      const ts = fingerprintTime(m.timestamp || m.time || m.createdAt);
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
      const ts = fingerprintTime(m.timestamp);
      const text = normalizeMsgText(m.text);
      const att = Array.isArray(m.attachments) ? m.attachments.length : 0;
      return `${ts}|${text}|${att}`;
    })
    .join(';;');
}

/** Notas internas persistidas no ticket (sem rascunho local do compose). */
/** Notas internas do agente (sem eventos de workflow em registroHistorico). */
export function buildAgentInternalNotesFingerprint(ticket) {
  if (!ticket) return '';
  return (ticket.internalNotes || [])
    .map((note) => {
      const raw = String(note.text || note.message || '').trim();
      const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      const ts = fingerprintTime(note.timestamp || note.time);
      return `${ts}|${text}`;
    })
    .filter(Boolean)
    .join(';;');
}

export function buildPersistedInternalNotesFingerprint(ticket) {
  return buildAgentInternalNotesFingerprint(ticket);
}

export function hasPublicThreadChanged(prevTicket, nextTicket) {
  if (!prevTicket && !nextTicket) return false;
  if (!prevTicket || !nextTicket) return true;
  return buildPublicThreadFingerprint(prevTicket) !== buildPublicThreadFingerprint(nextTicket);
}

export function hasPersistedInternalNotesChanged(prevTicket, nextTicket) {
  if (!prevTicket && !nextTicket) return false;
  if (!prevTicket || !nextTicket) return true;
  return buildPersistedInternalNotesFingerprint(prevTicket)
    !== buildPersistedInternalNotesFingerprint(nextTicket);
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
      const ts = fingerprintTime(m.timestamp || m.time || m.createdAt);
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

/**
 * Refresh da sugestão IA só com contexto que muda a consulta:
 * - ticket sem msg do cliente: nota interna persistida
 * - ticket com thread pública: nova mensagem do cliente
 * Histórico de workflow, transcrição e poll de registro NÃO entram aqui.
 */
export function buildAiSuggestionRefreshKey({
  ticketId,
  contextSource,
  useInternalContext,
  convMsgs,
  ticket,
}) {
  const id = String(ticketId || '');
  if (useInternalContext) {
    return [
      id,
      contextSource,
      'internal-context',
      buildAgentInternalNotesFingerprint(ticket),
    ].join('::');
  }
  return [
    id,
    contextSource,
    'client',
    buildClientThreadFingerprint(convMsgs),
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
