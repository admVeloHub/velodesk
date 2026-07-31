/**
 * ticketThreadSync v1.1.1 — última interação agente pausa sugestão IA
 * VERSION: v1.1.1 | DATE: 2026-07-31
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

/** Dispara refresh da sugestão IA (e-mail/chat: nova msg cliente; telefone: notas persistidas). */
export function buildAiSuggestionRefreshKey({
  ticketId,
  contextSource,
  isPhone,
  convMsgs,
  ticket,
  produtoHint,
}) {
  const id = String(ticketId || '');
  const hint = String(produtoHint || '').trim();
  if (isPhone) {
    return [
      id,
      contextSource,
      'phone',
      buildPersistedInternalNotesFingerprint(ticket),
      hint,
    ].join('::');
  }
  return [
    id,
    contextSource,
    'client',
    buildClientThreadFingerprint(convMsgs),
    hint,
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
  return getLastClientOrAgentConvMsg(convMsgs)?.type === 'agent';
}
