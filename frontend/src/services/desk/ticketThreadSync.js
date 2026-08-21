/**
 * ticketThreadSync v1.10.1 — fingerprint ignora notas automáticas do sistema
 * VERSION: v1.10.1 | DATE: 2026-08-21
 */

function normalizeMsgText(value) {
  return String(value || '').trim();
}

const PLACEHOLDER_CLIENT_MESSAGES = new Set([
  '[e-mail recebido]',
  '[anexo recebido]',
]);

/** Texto sintético de inbound sem conteúdo — não conta como contexto do cliente. */
export function isPlaceholderClientMessageText(text) {
  const plain = normalizeMsgText(text).toLowerCase();
  if (!plain) return true;
  return PLACEHOLDER_CLIENT_MESSAGES.has(plain);
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

/** Fingerprint do cliente com conteúdo real (exclui [E-mail recebido] e similares). */
export function buildMeaningfulClientThreadFingerprint(convMsgs) {
  return (convMsgs || [])
    .filter((m) => m?.type === 'client' && !isPlaceholderClientMessageText(m.text))
    .map((m) => {
      const ts = fingerprintTime(m.timestamp);
      const text = normalizeMsgText(m.text);
      const att = Array.isArray(m.attachments) ? m.attachments.length : 0;
      return `${ts}|${text}|${att}`;
    })
    .join(';;');
}

/** Notas internas do agente (sem eventos de workflow em registroHistorico). */
export function buildAgentInternalNotesFingerprint(ticket) {
  if (!ticket) return '';
  return (ticket.internalNotes || [])
    .filter((note) => {
      const author = String(note?.author || '').trim().toLowerCase();
      if (author === 'sistema') return false;
      const text = String(note.text || note.message || '').trim()
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) return false;
      if (/^novo ticket derivado de/i.test(text)) return false;
      return true;
    })
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
