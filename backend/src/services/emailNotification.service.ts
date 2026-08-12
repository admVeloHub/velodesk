/** emailNotification.service v1.8.0 — imagens coladas no compose vão como CID no e-mail */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { loadDadosForRef, normalizeEmail } from './cliente.service';
import { sendOutboundEmail } from './email-outbound.service';
import {
  buildEmailHeaderHtml,
  buildEmailLogoHeaderHtml,
  loadVelotaxLogoCompletoInline,
  loadVelotaxLogoInline,
} from './emailBrand.util';
import { composeHtmlToEmailHtml, escapeHtmlAttribute, htmlToPlainTextForEmail } from './emailHtml.util';
import { extractComposeInlineImages } from './composeInlineImages.util';
import {
  buildSendMaskClosingHtml,
  buildSendMaskClosingPlain,
} from './clientMessageSendMask.util';
import {
  buildOutboundMessageId,
  buildOutboundThreadHeaders,
  buildThreadSubject,
  persistOutboundEmailMeta,
} from './emailThread.service';
import { loadSentAttachmentsForEmail } from './sentAttachmentStorage.service';
import type { GmailInlineImage } from './gmail/gmailApiSend';

function buildBrandEmailHtml(title: string, bodyHtml: string): string {
  const logo = loadVelotaxLogoInline();
  const header = buildEmailHeaderHtml(title, Boolean(logo));
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:16px 24px">
  ${header}
  <div style="padding:0;margin:0">
    ${bodyHtml}
    <p style="margin-top:24px;font-size:12px;color:#666">VeloDesk — VeloHub</p>
  </div>
</body></html>`;
}

function buildOutboundEmailExtras(
  useLogoCompleto = false,
  extraInline: GmailInlineImage[] = [],
) {
  const logo = useLogoCompleto ? loadVelotaxLogoCompletoInline() : loadVelotaxLogoInline();
  const inlineImages = [
    ...(logo ? [logo] : []),
    ...extraInline,
  ];
  return inlineImages.length ? { inlineImages } : {};
}

function buildAgentReplyEmailHtml(
  composerText: string,
  chamado: IChamadoN1,
  preparedHtml?: string,
): string {
  const logo = loadVelotaxLogoCompletoInline();
  const header = buildEmailLogoHeaderHtml(Boolean(logo));
  const composerHtml = preparedHtml ?? composeHtmlToEmailHtml(composerText);
  const closingHtml = buildSendMaskClosingHtml(chamado);
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:16px 24px">
  ${header}
  <div style="padding:0;margin:0">
    ${composerHtml}
    ${closingHtml}
  </div>
</body></html>`;
}

export async function resolveClienteEmailFromChamado(chamado: IChamadoN1): Promise<string | null> {
  const ref = chamado.cliente?.[0];
  if (ref) {
    const dados = await loadDadosForRef(ref);
    const lista = dados?.clienteEmail?.lista ?? [];
    const resposta = normalizeEmail(dados?.clienteEmail?.resposta);
    if (resposta && lista.some((item) => normalizeEmail(item) === resposta)) {
      return resposta;
    }
    const email = lista[0];
    if (email?.includes('@')) return email.trim().toLowerCase();
  }

  for (const reg of chamado.registro ?? []) {
    const meta = (reg.metadados ?? {}) as Record<string, unknown>;
    const from = String(meta.emailFrom ?? '').trim().toLowerCase();
    if (from.includes('@')) return from;
  }

  return null;
}

export async function sendTicketOpenedEmail(
  chamado: IChamadoN1,
  clienteEmail?: string,
  registroIndex = 0
): Promise<void> {
  const to = clienteEmail ?? (await resolveClienteEmailFromChamado(chamado));
  if (!to) return;

  const protocolo = chamado.chamadoProtocolo;
  const titulo = chamado.chamadoTitulo || protocolo;
  const subject = buildThreadSubject(protocolo);
  const messageId = buildOutboundMessageId(protocolo);
  const headers = buildOutboundThreadHeaders(chamado, messageId);

  const body = `
    <p>Olá,</p>
    <p>Seu chamado foi registrado com sucesso.</p>
    <p><strong>Protocolo:</strong> ${escapeHtmlAttribute(protocolo)}</p>
    <p><strong>Assunto:</strong> ${escapeHtmlAttribute(titulo)}</p>
    <p>Para responder, utilize este e-mail mantendo o protocolo no assunto.</p>
  `;

  const result = await sendOutboundEmail({
    to,
    subject,
    text: `Protocolo ${protocolo} — ${titulo}`,
    html: buildBrandEmailHtml('Chamado registrado', body),
    headers,
    ...buildOutboundEmailExtras(),
  });

  if (!result.sent) {
    console.warn('[emailNotification] confirmação não enviada:', result.reason);
    return;
  }

  persistOutboundEmailMeta(chamado, messageId, registroIndex);
  await chamado.save();
}

export async function sendAgentReplyEmail(
  chamado: IChamadoN1,
  messageText: string,
  clienteEmail?: string,
  registroIndex?: number,
  attachmentUrls: string[] = [],
): Promise<void> {
  const to = clienteEmail ?? (await resolveClienteEmailFromChamado(chamado));
  const publicText = String(messageText ?? '').trim();
  const safeAttachmentUrls = (attachmentUrls || [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  if (!to || (!publicText && !safeAttachmentUrls.length)) return;

  const protocolo = chamado.chamadoProtocolo;
  const subject = buildThreadSubject(protocolo);
  const { html: htmlWithCids, inlineImages: composeInline } = extractComposeInlineImages(publicText);
  const plainMessage = publicText
    ? htmlToPlainTextForEmail(publicText) + buildSendMaskClosingPlain(chamado)
    : `Anexo(s) referente(s) ao chamado ${protocolo}.`;
  const messageHtml = publicText
    ? composeHtmlToEmailHtml(htmlWithCids)
    : '<p>Segue(m) anexo(s) referente(s) ao seu chamado.</p>';
  const messageId = buildOutboundMessageId(protocolo);
  const headers = buildOutboundThreadHeaders(chamado, messageId);
  const emailAttachments = await loadSentAttachmentsForEmail(safeAttachmentUrls);

  const htmlBody = publicText
    ? buildAgentReplyEmailHtml(publicText, chamado, messageHtml)
    : buildBrandEmailHtml('Nova mensagem no seu chamado', messageHtml);

  const result = await sendOutboundEmail({
    to,
    subject,
    text: plainMessage,
    html: htmlBody,
    headers,
    attachments: emailAttachments,
    ...buildOutboundEmailExtras(Boolean(publicText), composeInline),
  });

  if (!result.sent) {
    console.warn('[emailNotification] resposta agente não enviada:', result.reason);
    return;
  }

  persistOutboundEmailMeta(chamado, messageId, registroIndex);
  await chamado.save();
}

function findFirstPublicAgentMessage(chamado: IChamadoN1): { text: string; registroIndex: number } | null {
  for (let i = 0; i < (chamado.registro ?? []).length; i += 1) {
    const reg = chamado.registro![i];
    if (String(reg.origin ?? '').trim().toLowerCase() !== 'agente') continue;
    const text = String(reg.mensagemPublica ?? '').trim();
    if (text) return { text, registroIndex: i };
  }
  return null;
}

/** Ticket criado só com nota interna do agente — não notificar solicitante. */
function chamadoCreatedHasPublicClientMessage(chamado: IChamadoN1): boolean {
  for (const reg of chamado.registro ?? []) {
    const pub = String(reg.mensagemPublica ?? '').trim();
    const pubAttachments = (reg.anexosMensagemPublica ?? []).length;
    if (pub || pubAttachments) return true;
  }
  return false;
}

/** Criação de ticket: envia a 1ª mensagem pública do agente ou confirmação genérica. */
export async function notifyChamadoCreatedAsync(
  chamado: IChamadoN1,
  clienteEmail?: string,
): Promise<void> {
  try {
    if (!chamadoCreatedHasPublicClientMessage(chamado)) {
      return;
    }
    const firstAgentPublic = findFirstPublicAgentMessage(chamado);
    if (firstAgentPublic) {
      const reg = chamado.registro?.[firstAgentPublic.registroIndex];
      const attachmentUrls = (reg?.anexosMensagemPublica ?? [])
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      await sendAgentReplyEmail(
        chamado,
        firstAgentPublic.text,
        clienteEmail,
        firstAgentPublic.registroIndex,
        attachmentUrls,
      );
    } else {
      await sendTicketOpenedEmail(chamado, clienteEmail, 0);
    }
    await chamado.save();
  } catch (err) {
    console.warn('[emailNotification] notifyChamadoCreated:', (err as Error).message);
  }
}

/** Fail-soft: não propaga erro */
export async function notifyTicketOpenedAsync(chamado: IChamadoN1, clienteEmail?: string): Promise<void> {
  try {
    await sendTicketOpenedEmail(chamado, clienteEmail);
    await chamado.save();
  } catch (err) {
    console.warn('[emailNotification] notifyTicketOpened:', (err as Error).message);
  }
}

export async function notifyAgentReplyAsync(
  chamado: IChamadoN1,
  messageText: string,
  clienteEmail?: string,
  registroIndex?: number,
  attachmentUrls: string[] = [],
): Promise<void> {
  try {
    await sendAgentReplyEmail(
      chamado,
      messageText,
      clienteEmail,
      registroIndex,
      attachmentUrls,
    );
  } catch (err) {
    console.warn('[emailNotification] notifyAgentReply:', (err as Error).message);
  }
}
