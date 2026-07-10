/** emailThread.service v1.0.0 — Message-ID / In-Reply-To / References para thread Gmail */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { getEffectiveFromAddress } from './emailTransport.service';

export function normalizeEmailMessageId(value: unknown): string {
  return String(value ?? '').trim().replace(/^<|>$/g, '');
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

export function buildThreadSubject(protocolo: string, titulo: string, isReply: boolean): string {
  const base = `[${protocolo}] ${String(titulo || protocolo).trim()}`.trim();
  return isReply ? `Re: ${base}` : base;
}

export function collectEmailThreadState(chamado: IChamadoN1): EmailThreadState {
  let rootId: string | null = null;
  const referenceIds: string[] = [];

  for (const reg of chamado.registro ?? []) {
    const meta = (reg.metadados ?? {}) as Record<string, unknown>;
    const root = normalizeEmailMessageId(meta.emailThreadRootId);
    const outbound = normalizeEmailMessageId(meta.emailOutboundMessageId);

    if (root && !rootId) rootId = root;
    if (outbound) referenceIds.push(outbound);
  }

  if (!rootId && referenceIds.length) {
    rootId = referenceIds[0];
  }

  return { rootId, referenceIds };
}

export function buildOutboundThreadHeaders(
  chamado: IChamadoN1,
  messageId: string
): OutboundEmailThreadHeaders {
  const { rootId, referenceIds } = collectEmailThreadState(chamado);

  if (!rootId) {
    return { messageId };
  }

  const inReplyTo = referenceIds[referenceIds.length - 1] || rootId;
  const references = [...new Set([rootId, ...referenceIds])];

  return {
    messageId,
    inReplyTo,
    references,
  };
}

export function persistOutboundEmailMeta(
  chamado: IChamadoN1,
  messageId: string,
  registroIndex?: number
): void {
  const normalized = normalizeEmailMessageId(messageId);
  if (!normalized) return;

  const idx = resolveRegistroIndexForOutbound(chamado, registroIndex);
  if (idx < 0) return;

  const reg = chamado.registro[idx];
  if (!reg) return;

  const meta = { ...(reg.metadados ?? {}) } as Record<string, unknown>;
  meta.emailOutboundMessageId = normalized;

  const existingRoot = normalizeEmailMessageId(meta.emailThreadRootId)
    || collectEmailThreadState(chamado).rootId;

  meta.emailThreadRootId = existingRoot || normalized;
  reg.metadados = meta;
}

function resolveRegistroIndexForOutbound(chamado: IChamadoN1, registroIndex?: number): number {
  if (typeof registroIndex === 'number' && registroIndex >= 0) {
    return registroIndex;
  }

  for (let i = (chamado.registro?.length ?? 0) - 1; i >= 0; i -= 1) {
    const reg = chamado.registro[i];
    if (String(reg?.mensagemPublica ?? '').trim()) return i;
  }

  return chamado.registro?.length ? 0 : -1;
}
