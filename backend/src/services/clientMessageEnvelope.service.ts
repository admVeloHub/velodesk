/**
 * clientMessageEnvelope.service v1.1.0 — resolveClientGreetingName exportado (WhatsApp template)
 * VERSION: v1.1.0 | DATE: 2026-08-11
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

/** Monta texto do composer: abertura mecânica + núcleo (sem fechamento visual). */
export function wrapComposerOpening(params: WrapComposerOpeningParams): string {
  const nucleo = trimStr(params.nucleo, 32_000);
  if (!nucleo) return '';

  const modo = params.modo ?? detectEnvelopeModo(params.messages);
  if (modo === 'continuacao') {
    return nucleo;
  }

  const clientGreeting = resolveClientGreetingName(params.clientName);
  const agentDisplay = resolveAgentDisplayName(params.agentName);

  return [
    `Olá, ${clientGreeting}, tudo bem?`,
    '',
    `Eu sou ${agentDisplay}, do time de atendimento Velotax.`,
    '',
    nucleo,
  ].join('\n');
}
