/**
 * clientMessageEnvelope v1.1.0 — stripComposerOpening (refinar / normalização núcleo)
 * VERSION: v1.1.0 | DATE: 2026-08-20
 */

function trimStr(value, maxLen = 200) {
  return String(value ?? '').trim().slice(0, maxLen);
}

function resolveClientFirstName(fullName) {
  const name = trimStr(fullName, 200);
  if (!name) return '';
  return name.split(/\s+/)[0] || name;
}

function resolveClientGreetingName(clientName) {
  const first = resolveClientFirstName(clientName);
  return first || 'cliente';
}

function resolveAgentDisplayName(agentName) {
  const name = trimStr(agentName, 120);
  return name || 'Atendimento Velotax';
}

/**
 * Abertura mecânica aplicada no composer — envelope completo no 1º contato
 * ("Olá, X, tudo bem?\n\nEu sou Y...") ou só a saudação curta nas mensagens
 * seguintes ("Oi, X, tudo bem?"). Sem se apresentar de novo, mas sempre cordial.
 */
const MECHANICAL_OPENING_RE = /^(?:Olá,\s*.+?,\s*tudo bem\?\s*\r?\n\s*\r?\nEu sou .+?, do time de atendimento Velotax\.\s*\r?\n\s*\r?\n|Oi,\s*.+?,\s*tudo bem\?\s*\r?\n\s*\r?\n)/s;

/** Remove abertura mecânica do composer para obter só o núcleo. */
export function stripComposerOpening(text) {
  const raw = trimStr(text, 32000);
  if (!raw) return '';
  const stripped = raw.replace(MECHANICAL_OPENING_RE, '').trim();
  return stripped || raw;
}

/** @param {Array<{ role?: string }>} messages */
export function detectEnvelopeModoFromTicketMessages(messages = []) {
  if (!messages.length) return 'primeiro_contato';
  const hasAgent = messages.some((m) => {
    const role = String(m?.role ?? '').toLowerCase();
    return role === 'agente' || role === 'agent' || role === 'me';
  });
  return hasAgent ? 'continuacao' : 'primeiro_contato';
}

/**
 * @param {object} params
 * @param {string} params.nucleo
 * @param {string} [params.clientName]
 * @param {string} [params.agentName]
 * @param {'primeiro_contato'|'continuacao'} [params.modo]
 */
export function wrapComposerOpening(params) {
  const nucleo = trimStr(params?.nucleo, 32000);
  if (!nucleo) return '';

  const modo = params?.modo || 'primeiro_contato';
  const clientGreeting = resolveClientGreetingName(params?.clientName);

  if (modo === 'continuacao') {
    // Sem se apresentar de novo — mas continua cordial: só a saudação curta.
    return [`Oi, ${clientGreeting}, tudo bem?`, '', nucleo].join('\n');
  }

  const agentDisplay = resolveAgentDisplayName(params?.agentName);

  return [
    `Olá, ${clientGreeting}, tudo bem?`,
    '',
    `Eu sou ${agentDisplay}, do time de atendimento Velotax.`,
    '',
    nucleo,
  ].join('\n');
}

/**
 * Detecta modo a partir do ticket Desk (registro público do agente).
 * @param {object} ticket
 */
export function detectEnvelopeModoFromTicket(ticket) {
  const registro = ticket?.registro || ticket?.messages || [];
  const publicAgentMsgs = registro.filter((reg) => {
    const origin = String(reg?.origin ?? reg?.sender ?? '').toLowerCase();
    const isAgent = origin === 'agente' || origin === 'agent' || origin === 'me';
    const text = String(reg?.mensagemPublica ?? reg?.text ?? reg?.body ?? '').trim();
    return isAgent && text.length > 0;
  });
  return publicAgentMsgs.length === 0 ? 'primeiro_contato' : 'continuacao';
}

/**
 * @param {object} params
 * @param {string} params.nucleo
 * @param {object} params.ticket
 * @param {string} params.agentName
 */
export function wrapComposerOpeningForTicket({ nucleo, ticket, agentName }) {
  const clientName = ticket?.clientName
    || ticket?.client?.name
    || ticket?.lateralForm?.clienteNome
    || ticket?.titulo
    || '';
  const modo = detectEnvelopeModoFromTicket(ticket);
  return wrapComposerOpening({
    nucleo,
    clientName,
    agentName,
    modo,
  });
}
