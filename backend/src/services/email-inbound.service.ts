/** email-inbound.service v1.0.0 — webhook e-mail → chamados_n1 */
import { ChamadoN1 } from '../models/ChamadoN1';
import { appendMessage, createChamadoFromBody } from './chamado.mapper';
import { normalizeEmail, resolveClienteRefFromEmail } from './cliente.service';
import type { InboundEmailPayload, InboundEmailProcessResult } from './inbound-email/types';

export const PROTOCOL_PATTERN = /VD-\d{8}-\d{4}/i;

export function normalizeMessageId(value: unknown): string {
  return String(value ?? '').trim().replace(/^<|>$/g, '');
}

export function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveEmailBody(payload: InboundEmailPayload): string {
  const text = payload.textBody.trim();
  if (text) return text;
  if (payload.htmlBody) return stripHtml(payload.htmlBody);
  return '';
}

export function extractProtocolFromSubject(subject: string): string | null {
  const match = subject.match(PROTOCOL_PATTERN);
  return match ? match[0].toUpperCase() : null;
}

export function buildEmailAlteracoes(payload: InboundEmailPayload): Record<string, unknown> {
  return {
    source: 'email-inbound',
    emailMessageId: normalizeMessageId(payload.messageId),
    emailFrom: payload.from.email,
    emailSubject: payload.subject,
    emailInReplyTo: payload.inReplyTo ? normalizeMessageId(payload.inReplyTo) : undefined,
    emailReferences: payload.references?.map((item) => normalizeMessageId(item)),
  };
}

export async function findChamadoByEmailMessageId(messageId: string) {
  const normalized = normalizeMessageId(messageId);
  if (!normalized) return null;
  return ChamadoN1.findOne({ 'registro.alteracoes.emailMessageId': normalized });
}

export async function findChamadoForEmailReply(payload: InboundEmailPayload) {
  const protocol = extractProtocolFromSubject(payload.subject);
  if (protocol) {
    const byProtocol = await ChamadoN1.findOne({ chamadoProtocolo: protocol });
    if (byProtocol) return byProtocol;
  }

  const candidates = [payload.inReplyTo, ...(payload.references ?? [])]
    .map((item) => normalizeMessageId(item))
    .filter(Boolean);

  for (const candidate of candidates) {
    const found = await findChamadoByEmailMessageId(candidate);
    if (found) return found;
  }

  return null;
}

function attachmentUrls(payload: InboundEmailPayload): string[] {
  return (payload.attachments ?? [])
    .map((item) => item.url)
    .filter((url): url is string => Boolean(url));
}

export async function processInboundEmail(payload: InboundEmailPayload): Promise<InboundEmailProcessResult> {
  const messageId = normalizeMessageId(payload.messageId);
  if (!messageId) {
    throw new Error('Message-Id ausente no e-mail inbound');
  }

  const duplicate = await findChamadoByEmailMessageId(messageId);
  if (duplicate) {
    return {
      action: 'duplicate',
      chamadoProtocolo: duplicate.chamadoProtocolo,
      ticketId: duplicate._id.toString(),
    };
  }

  const bodyText = resolveEmailBody(payload);
  const emailMeta = buildEmailAlteracoes(payload);
  const attachments = attachmentUrls(payload);

  const existing = await findChamadoForEmailReply(payload);
  if (existing) {
    appendMessage(existing, bodyText, false, 'them', attachments, emailMeta);
    await existing.save();
    return {
      action: 'replied',
      chamadoProtocolo: existing.chamadoProtocolo,
      ticketId: existing._id.toString(),
    };
  }

  const clienteRef = await resolveClienteRefFromEmail(payload.from.email, payload.from.name);
  const subject = payload.subject.trim() || 'Atendimento por e-mail';
  const displayName = payload.from.name || payload.from.email.split('@')[0];

  const ticketBody: Record<string, unknown> = {
    title: subject,
    chamadoTitulo: subject,
    description: bodyText,
    text: bodyText,
    status: 'novo',
    clientName: displayName,
    attachments,
    lateralForm: {
      clienteEmail: [payload.from.email],
      clienteNome: displayName,
      canal: 'E-mail',
      classificacaoTipo: 'Solicitação',
      motivo: subject,
      detalhe: bodyText.slice(0, 500),
    },
  };

  if (clienteRef?.clienteId) ticketBody.clienteId = clienteRef.clienteId.toString();
  if (clienteRef?.clienteCpf) ticketBody.clientCPF = clienteRef.clienteCpf;

  const partial = await createChamadoFromBody(ticketBody, 'novo');
  if (partial.registro?.[0]) {
    partial.registro[0].alteracoes = {
      ...(partial.registro[0].alteracoes ?? {}),
      ...emailMeta,
    };
  }

  if (clienteRef && (!partial.cliente || partial.cliente.length === 0)) {
    partial.cliente = [clienteRef];
  }

  const chamado = await ChamadoN1.create(partial);
  return {
    action: 'created',
    chamadoProtocolo: chamado.chamadoProtocolo,
    ticketId: chamado._id.toString(),
  };
}

export function isAllowedRecipient(payload: InboundEmailPayload, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const allowedSet = new Set(allowed.map((item) => normalizeEmail(item)));
  return payload.to.some((item) => allowedSet.has(normalizeEmail(item)));
}

