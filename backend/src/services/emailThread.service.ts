/** emailThread.service v1.3.0 — thread única por chamado (In-Reply-To/References + assunto fixo) */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { getEffectiveFromAddress } from './emailTransport.service';

export function normalizeEmailMessageId(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/^<|>$/g, '');
  if (!raw) return '';
  return raw.includes('@') ? `<${raw}>` : raw;
}

export interface EmailThreadState {
  rootId: string | null;
  referenceIds: string[];
}

export interface OutboundEmailThreadHeaders {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

function domainFromAddress(address: string): string {
  const parts = String(address ?? '').trim().toLowerCase().split('@');
  return parts[1] || 'velotax.com.br';
}

export function buildOutboundMessageId(protocolo: string, fromAddress?: string): string {
  const domain = domainFromAddress(fromAddress || getEffectiveFromAddress());
  const safe = String(protocolo ?? '').replace(/[^a-zA-Z0-9]/g, '') || 'ticket';
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `<desk.${safe}.${token}@${domain}>`;
}

/** Âncora estável da thread por protocolo — garante encadeamento mesmo sem e-mail inbound. */
export function buildProtocolThreadRootId(protocolo: string, fromAddress?: string): string {
  const domain = domainFromAddress(fromAddress || getEffectiveFromAddress());
  const safe = String(protocolo ?? '').replace(/[^a-zA-Z0-9]/g, '') || 'ticket';
  return `<desk.thread.${safe}@${domain}>`;
}

/** Assunto padronizado ao cliente — mantém [protocolo] para roteamento inbound. */
export function buildClientEmailSubject(protocolo: string, isReply = false): string {
  const safeProtocolo = String(protocolo ?? '').trim();
  const base = `[${safeProtocolo}] Atendimento Velotax Numero ${safeProtocolo}`.trim();
  return isReply ? `Re: ${base}` : base;
}

/** Assunto único por chamado — todas as respostas do agente usam o mesmo formato (Re:). */
export function buildThreadSubject(protocolo: string, _titulo?: string, _isReply = false): string {
  return buildClientEmailSubject(protocolo, true);
}

export function collectEmailThreadState(chamado: IChamadoN1): EmailThreadState {
  let rootId: string | null = null;
  const referenceIds: string[] = [];

  for (const reg of chamado.registro ?? []) {
    const meta = (reg.metadados ?? {}) as Record<string, unknown>;
    const root = normalizeEmailMessageId(meta.emailThreadRootId);
    const outbound = normalizeEmailMessageId(meta.emailOutboundMessageId);
    const inbound = normalizeEmailMessageId(meta.emailMessageId);

    if (root && !rootId) rootId = root;
    if (outbound) referenceIds.push(outbound);
    if (inbound && !rootId) rootId = inbound;
  }

  if (!rootId && chamado.chamadoProtocolo) {
    rootId = buildProtocolThreadRootId(chamado.chamadoProtocolo);
  }

  if (!rootId && referenceIds.length) {
    rootId = referenceIds[0];
  }

  return { rootId, referenceIds };
}

export function buildOutboundThreadHeaders(
  chamado: IChamadoN1,
  messageId: string,
): OutboundEmailThreadHeaders {
  const protocolRoot = chamado.chamadoProtocolo
    ? buildProtocolThreadRootId(chamado.chamadoProtocolo)
    : '';
  const { rootId, referenceIds } = collectEmailThreadState(chamado);
  const effectiveRoot = rootId || protocolRoot;

  if (!effectiveRoot) {
    return { messageId };
  }

  const inReplyTo = referenceIds.length
    ? referenceIds[referenceIds.length - 1]
    : effectiveRoot;
  const references = [...new Set([effectiveRoot, ...referenceIds].filter(Boolean))];

  return {
    messageId,
    inReplyTo,
    references,
  };
}

export function persistOutboundEmailMeta(
  chamado: IChamadoN1,
  messageId: string,
  registroIndex?: number,
): void {
  const normalized = normalizeEmailMessageId(messageId);
  if (!normalized) return;

  const idx = resolveRegistroIndexForOutbound(chamado, registroIndex);
  if (idx < 0) return;

  const reg = chamado.registro[idx];
  if (!reg) return;

  const meta = { ...(reg.metadados ?? {}) } as Record<string, unknown>;
  meta.emailOutboundMessageId = normalized.replace(/^<|>$/g, '');

  const protocolRoot = chamado.chamadoProtocolo
    ? buildProtocolThreadRootId(chamado.chamadoProtocolo).replace(/^<|>$/g, '')
    : '';
  const existingRoot = normalizeEmailMessageId(meta.emailThreadRootId)
    || collectEmailThreadState(chamado).rootId?.replace(/^<|>$/g, '')
    || protocolRoot;

  meta.emailThreadRootId = existingRoot || normalized.replace(/^<|>$/g, '');
  reg.metadados = meta;
}

function resolveRegistroIndexForOutbound(chamado: IChamadoN1, registroIndex?: number): number {
  if (typeof registroIndex === 'number' && registroIndex >= 0) {
    return registroIndex;
  }

  for (let i = (chamado.registro?.length ?? 0) - 1; i >= 0; i -= 1) {
    const reg = chamado.registro[i];
    const hasPublicText = Boolean(String(reg?.mensagemPublica ?? '').trim());
    const hasPublicAttachments = (reg?.anexosMensagemPublica?.length ?? 0) > 0;
    if (hasPublicText || hasPublicAttachments) return i;
  }

  return chamado.registro?.length ? 0 : -1;
}
