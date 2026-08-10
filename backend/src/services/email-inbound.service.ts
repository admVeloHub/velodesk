/** email-inbound.service v1.13.0 — classificador como hint; Agente 4 sempre no create */
import { decodeBasicHtmlEntities } from './emailHtml.util';
import { ChamadoN1 } from '../models/ChamadoN1';
import { ChamadoIaAnalise } from '../models/ChamadoIaAnalise';
import { applyAssignmentIfNeeded } from './assignmentRouter.service';
import {
  appendMessage,
  createChamadoFromBody,
  resolveInboundClientReplyStatus,
  shouldSpawnNewTicketOnInbound,
} from './chamado.mapper';
import { normalizeEmail, resolveClienteRefFromEmail } from './cliente.service';
import { notifyTicketOpenedAsync } from './emailNotification.service';
import { runInboundPostCreateHooks } from './agents/inboundAgentPipeline.service';
import { runCasosEspeciaisTriagem } from './agents/casosEspeciaisTrigger.service';
import { matchMailRule } from './mailRules.service';
import {
  claimInboundMessage,
  markInboundMessageDone,
  markInboundMessageFailed,
} from './inboundDedupe.service';
import { extractEmailReplyContent } from './emailReplyContent.util';
import {
  attachmentMatchesKnownFingerprints,
  collectChamadoAttachmentFingerprints,
} from './attachmentFilter.util';
import type { InboundEmailPayload, InboundEmailProcessResult } from './inbound-email/types';
import type { IChamadoN1 } from '../models/ChamadoN1';
import {
  classifyInboundEspeciaisChannel,
  type InboundEspeciaisChannel,
} from './inbound-email/inboundChannelClassifier.service';

export const LEGACY_PROTOCOL_PATTERN = /VD-\d{8}-\d{4}/i;
export const NUMERIC_PROTOCOL_PATTERN = /\[(\d{8,10})\]/;

export function normalizeMessageId(value: unknown): string {
  return String(value ?? '').trim().replace(/^<|>$/g, '');
}

export function stripHtml(html: string): string {
  const stripped = html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeBasicHtmlEntities(stripped);
}

export function resolveEmailBody(payload: InboundEmailPayload): string {
  const text = payload.textBody.trim();
  const raw = text || (payload.htmlBody ? stripHtml(payload.htmlBody) : '');
  return extractEmailReplyContent(raw);
}

export function extractProtocolFromSubject(subject: string): string | null {
  const legacy = subject.match(LEGACY_PROTOCOL_PATTERN);
  if (legacy) return legacy[0].toUpperCase();

  const bracket = subject.match(NUMERIC_PROTOCOL_PATTERN);
  if (bracket?.[1]) return bracket[1];

  return null;
}

export function buildEmailMetadados(payload: InboundEmailPayload): Record<string, unknown> {
  return {
    source: 'email-inbound',
    emailMessageId: normalizeMessageId(payload.messageId),
    emailFrom: payload.from.email,
    emailSubject: payload.subject,
    emailInReplyTo: payload.inReplyTo ? normalizeMessageId(payload.inReplyTo) : undefined,
    emailReferences: payload.references?.map((item) => normalizeMessageId(item)),
  };
}

/** @deprecated use buildEmailMetadados */
export const buildEmailAlteracoes = buildEmailMetadados;

export async function findChamadoByEmailMessageId(messageId: string) {
  const normalized = normalizeMessageId(messageId);
  if (!normalized) return null;
  return ChamadoN1.findOne({
    $or: [
      { 'registro.metadados.emailMessageId': normalized },
      { 'registro.metadados.emailOutboundMessageId': normalized },
      { 'registro.metadados.emailThreadRootId': normalized },
      { 'registro.alteracoes.emailMessageId': normalized },
    ],
  });
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

/** Remove anexos já presentes em mensagens anteriores do mesmo ticket. */
function retainOnlyNewAttachments(
  payload: InboundEmailPayload,
  chamado: IChamadoN1 | null | undefined,
): void {
  const attachments = payload.attachments ?? [];
  if (!attachments.length || !chamado) return;

  const known = collectChamadoAttachmentFingerprints(chamado);
  const kept = attachments.filter((item) => !attachmentMatchesKnownFingerprints(item, known));
  if (kept.length !== attachments.length) {
    console.info('[email-inbound] anexos da thread anterior removidos da mensagem atual', {
      antes: attachments.length,
      depois: kept.length,
      protocolo: chamado.chamadoProtocolo,
    });
  }
  payload.attachments = kept;
}

function buildAttachmentMetadados(payload: InboundEmailPayload): Record<string, unknown> {
  const items = (payload.attachments ?? [])
    .filter((item) => item.url || item.gcsUri)
    .map((item) => ({
      filename: item.filename,
      url: item.url,
      gcsUri: item.gcsUri,
      storageKey: item.storageKey,
      contentHash: item.contentHash,
      bytes: item.bytes,
    }));
  return items.length ? { emailAttachments: items } : {};
}

function appendAttachmentReferencesToBody(bodyText: string, payload: InboundEmailPayload): string {
  const lines = (payload.attachments ?? [])
    .filter((item) => item.gcsUri || item.url)
    .map((item) => {
      const label = String(item.filename || 'anexo').trim();
      const ref = String(item.gcsUri || item.url || '').trim();
      return `[Anexo: ${label}] ${ref}`;
    });
  if (!lines.length) return bodyText;
  const block = lines.join('\n');
  const base = String(bodyText || '').trim();
  return base ? `${base}\n\n${block}` : block;
}

export async function processInboundEmail(payload: InboundEmailPayload): Promise<InboundEmailProcessResult> {
  const messageId = normalizeMessageId(payload.messageId);
  if (!messageId) {
    throw new Error('Message-Id ausente no e-mail inbound');
  }

  const rule = matchMailRule(payload);
  if (rule === 'spam' || rule === 'ignored') {
    console.info('[email-inbound] skipped', {
      rule,
      from: payload.from.email,
      messageId,
      subject: payload.subject,
    });
    return {
      action: 'skipped',
      reason: rule,
      messageId,
    };
  }

  const claim = await claimInboundMessage(messageId);
  if (!claim.granted) {
    console.info('[email-inbound] claim negado', {
      messageId,
      reason: claim.reason,
      protocolo: claim.previous?.chamadoProtocolo || null,
    });
    return {
      action: 'duplicate',
      chamadoProtocolo: claim.previous?.chamadoProtocolo || undefined,
      ticketId: claim.previous?.ticketId || undefined,
      messageId,
    };
  }

  try {
    const result = await runInboundEmailFlow(payload, messageId, rule === 'priority');
    await markInboundMessageDone(messageId, {
      action: result.action,
      chamadoProtocolo: result.chamadoProtocolo,
      ticketId: result.ticketId,
    });
    return result;
  } catch (err) {
    await markInboundMessageFailed(messageId, (err as Error).message);
    throw err;
  }
}

function buildInboundEspeciaisTicketBody(
  payload: InboundEmailPayload,
  channel: InboundEspeciaisChannel,
  bodyText: string,
  displayName: string,
  subject: string,
  attachments: string[],
  isPriority: boolean,
): Record<string, unknown> {
  const lateralBase = {
    clienteEmail: [payload.from.email],
    clienteNome: displayName,
    classificacaoTipo: 'Reclamação',
    motivo: subject,
    detalhe: bodyText.slice(0, 500),
  };

  if (channel === 'procon') {
    return {
      title: subject,
      chamadoTitulo: subject,
      description: bodyText,
      text: bodyText,
      status: 'novo',
      priority: isPriority ? 'alta' : 'media',
      clientName: displayName,
      attachments,
      messageOrigin: 'cliente',
      sender: 'them',
      lateralForm: {
        ...lateralBase,
        canal: 'Procon',
        procon: {
          assunto: subject,
          descricao: bodyText,
          consumidor: displayName,
          statusPc: 'nao-respondida',
        },
      },
    };
  }

  return {
    title: subject,
    chamadoTitulo: subject,
    description: bodyText,
    text: bodyText,
    status: 'novo',
    priority: isPriority ? 'alta' : 'media',
    clientName: displayName,
    attachments,
    messageOrigin: 'cliente',
    sender: 'them',
    lateralForm: {
      ...lateralBase,
      canal: 'Consumidor.Gov',
      consumidorGov: {
        assunto: subject,
        descricao: bodyText,
        consumidor: displayName,
        statusGov: 'nao-respondida',
      },
    },
  };
}

async function runInboundEmailFlow(
  payload: InboundEmailPayload,
  messageId: string,
  isPriority: boolean,
): Promise<InboundEmailProcessResult> {
  const duplicate = await findChamadoByEmailMessageId(messageId);
  if (duplicate) {
    return {
      action: 'duplicate',
      chamadoProtocolo: duplicate.chamadoProtocolo,
      ticketId: duplicate._id.toString(),
    };
  }

  const existing = await findChamadoForEmailReply(payload);
  retainOnlyNewAttachments(payload, existing);

  const bodyText = appendAttachmentReferencesToBody(resolveEmailBody(payload), payload);
  const emailMeta = {
    ...buildEmailMetadados(payload),
    ...buildAttachmentMetadados(payload),
  };
  const attachments = attachmentUrls(payload);

  if (existing && !shouldSpawnNewTicketOnInbound(existing)) {
    const statusOverride = resolveInboundClientReplyStatus(existing);
    appendMessage(existing, bodyText, false, 'them', attachments, emailMeta, statusOverride);
    await existing.save();
    await ChamadoIaAnalise.updateOne(
      { chamadoId: existing._id, origem: { $ne: 'manual' } },
      { $set: { needsReanalysis: true } },
    );
    void runCasosEspeciaisTriagem(existing, { source: 'email-inbound-reply' }).catch((err: Error) => {
      console.warn('[email-inbound] triagem casos especiais fail-soft:', err.message);
    });
    return {
      action: 'replied',
      chamadoProtocolo: existing.chamadoProtocolo,
      ticketId: existing._id.toString(),
    };
  }

  const clienteRef = await resolveClienteRefFromEmail(payload.from.email, payload.from.name);
  const subject = payload.subject.trim() || 'Atendimento por e-mail';
  const displayName = payload.from.name || payload.from.email.split('@')[0];
  const inboundRootId = normalizeMessageId(payload.messageId);
  const canalProvavel = classifyInboundEspeciaisChannel(payload);

  const ticketBody: Record<string, unknown> = canalProvavel
    ? buildInboundEspeciaisTicketBody(
      payload,
      canalProvavel,
      bodyText,
      displayName,
      subject,
      attachments,
      isPriority,
    )
    : {
      title: subject,
      chamadoTitulo: subject,
      description: bodyText,
      text: bodyText,
      status: 'novo',
      priority: isPriority ? 'alta' : 'media',
      clientName: displayName,
      attachments,
      lateralForm: {
        clienteEmail: [payload.from.email],
        clienteEmailResposta: payload.from.email,
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
    partial.registro[0].origin = 'cliente';
    partial.registro[0].autor = displayName;
    partial.registro[0].metadados = {
      ...(partial.registro[0].metadados ?? {}),
      ...emailMeta,
      source: 'email-inbound',
      emailInbound: true,
      emailThreadRootId: inboundRootId,
      ...(canalProvavel ? { canalProvavel, inboxDedicada: true } : {}),
      ...(isPriority ? { mailPriority: 'alta' } : {}),
    };
    partial.registro[0].alteracoes = partial.registro[0].alteracoes ?? [];
  }

  if (clienteRef && (!partial.cliente || partial.cliente.length === 0)) {
    partial.cliente = [clienteRef];
  }

  await applyAssignmentIfNeeded(partial, {
    source: 'email-inbound',
    canal: canalProvavel === 'procon'
      ? 'Procon'
      : canalProvavel === 'consumidor-gov'
        ? 'Consumidor.Gov'
        : 'E-mail',
  });

  const chamado = await ChamadoN1.create(partial);
  await notifyTicketOpenedAsync(chamado, payload.from.email);

  void runInboundPostCreateHooks(chamado, { source: 'email-inbound' }).catch((err: Error) => {
    console.warn('[email-inbound] hooks inbound fail-soft:', err.message);
  });

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
