/**
 * clientMessageEnvelope.service v1.2.0 — stripComposerOpening (refinar / normalização núcleo)
 * VERSION: v1.2.0 | DATE: 2026-08-20
 */
import type { TicketAiMessageInput } from './agents/agentTypes';
import { isPrimeiroContatoAgente } from './agents/agentTabulation.util';
import { resolveClientFirstName, trimStr } from './agents/openaiAgent.util';

export type EnvelopeModo = 'primeiro_contato' | 'continuacao';

export interface WrapComposerOpeningParams {
  nucleo: string;
  clientName?: string;
  agentName?: string;
  messages?: TicketAiMessageInput[];
  modo?: EnvelopeModo;
}

export function detectEnvelopeModo(messages?: TicketAiMessageInput[]): EnvelopeModo {
  return isPrimeiroContatoAgente(messages) ? 'primeiro_contato' : 'continuacao';
}

/** Primeiro nome do cliente para saudação (template WhatsApp, envelope composer, etc.). */
export function resolveClientGreetingName(clientName?: string, fallback = 'cliente'): string {
  const first = resolveClientFirstName(trimStr(clientName, 200));
  return first || fallback;
}

function resolveAgentDisplayName(agentName?: string): string {
  const name = trimStr(agentName, 120);
  return name || 'Atendimento Velotax';
}

/**
 * Abertura mecânica aplicada no composer — envelope completo no 1º contato
 * ("Olá, X, tudo bem?\n\nEu sou Y...") ou só a saudação curta nas mensagens
 * seguintes ("Oi, X, tudo bem?"). Sem se apresentar de novo, mas sempre cordial.
 */
const MECHANICAL_OPENING_RE = /^(?:Olá,\s*.+?,\s*tudo bem\?\s*\r?\n\s*\r?\nEu sou .+?, do time de atendimento Velotax\.\s*\r?\n\s*\r?\n|Oi,\s*.+?,\s*tudo bem\?\s*\r?\n\s*\r?\n)/s;

/** Remove abertura mecânica do composer para obter só o núcleo (refinar, IA). */
export function stripComposerOpening(text: string): string {
  const raw = trimStr(text, 32_000);
  if (!raw) return '';
  const stripped = raw.replace(MECHANICAL_OPENING_RE, '').trim();
  return stripped || raw;
}

/** Monta texto do composer: abertura mecânica + núcleo (sem fechamento visual). */
export function wrapComposerOpening(params: WrapComposerOpeningParams): string {
  const nucleo = trimStr(params.nucleo, 32_000);
  if (!nucleo) return '';

  const modo = params.modo ?? detectEnvelopeModo(params.messages);
  const clientGreeting = resolveClientGreetingName(params.clientName);

  if (modo === 'continuacao') {
    // Sem se apresentar de novo — mas continua cordial: só a saudação curta.
    return [`Oi, ${clientGreeting}, tudo bem?`, '', nucleo].join('\n');
  }

  const agentDisplay = resolveAgentDisplayName(params.agentName);

  return [
    `Olá, ${clientGreeting}, tudo bem?`,
    '',
    `Eu sou ${agentDisplay}, do time de atendimento Velotax.`,
    '',
    nucleo,
  ].join('\n');
}
