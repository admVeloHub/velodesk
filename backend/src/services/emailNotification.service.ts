/** emailNotification.service v1.1.0 — formatação rica + thread Gmail */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { loadDadosForRef } from './cliente.service';
import { buildProtocolSubject, sendOutboundEmail } from './email-outbound.service';
import { composeHtmlToEmailHtml, escapeHtmlAttribute, htmlToPlainTextForEmail } from './emailHtml.util';
import {
  buildOutboundMessageId,
  buildOutboundThreadHeaders,
  buildThreadSubject,
  persistOutboundEmailMeta,
} from './emailThread.service';

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#1634FF;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">${title}</h2>
    </div>
    <div style="background:#f9f9f9;padding:20px;border-radius:0 0 8px 8px">
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#666">VeloDesk — VeloHub</p>
    </div>
  </div>
</body></html>`;
}

export async function resolveClienteEmailFromChamado(chamado: IChamadoN1): Promise<string | null> {
  const ref = chamado.cliente?.[0];
  if (!ref) return null;
  const dados = await loadDadosForRef(ref);
  const email = dados?.clienteEmail?.lista?.[0];
  return email?.includes('@') ? email.trim().toLowerCase() : null;
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
  const subject = buildThreadSubject(protocolo, titulo, false);
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
    html: baseTemplate('Chamado registrado', body),
    headers,
  });

  if (!result.sent) {
    console.warn('[emailNotification] confirmação não enviada:', result.reason);
    return;
  }

  persistOutboundEmailMeta(chamado, messageId, registroIndex);
}

export async function sendAgentReplyEmail(
  chamado: IChamadoN1,
  messageText: string,
  clienteEmail?: string,
  registroIndex?: number
): Promise<void> {
  const to = clienteEmail ?? (await resolveClienteEmailFromChamado(chamado));
  if (!to || !messageText.trim()) return;

  const protocolo = chamado.chamadoProtocolo;
  const titulo = chamado.chamadoTitulo || protocolo;
  const subject = buildThreadSubject(protocolo, titulo, true);
  const plainMessage = htmlToPlainTextForEmail(messageText);
  const messageHtml = composeHtmlToEmailHtml(messageText);
  const safeProtocolo = escapeHtmlAttribute(protocolo);
  const messageId = buildOutboundMessageId(protocolo);
  const headers = buildOutboundThreadHeaders(chamado, messageId);

  const body = `
    <p>Olá,</p>
    <p>Há uma nova mensagem sobre seu chamado <strong>${safeProtocolo}</strong>:</p>
    <div style="background:#fff;padding:12px;border-left:4px solid #1634FF;margin:12px 0">${messageHtml}</div>
    <p>Responda este e-mail para continuar o atendimento.</p>
  `;

  const result = await sendOutboundEmail({
    to,
    subject,
    text: plainMessage,
    html: baseTemplate('Nova mensagem no seu chamado', body),
    headers,
  });

  if (!result.sent) {
    console.warn('[emailNotification] resposta agente não enviada:', result.reason);
    return;
  }

  persistOutboundEmailMeta(chamado, messageId, registroIndex);
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
  registroIndex?: number
): Promise<void> {
  try {
    await sendAgentReplyEmail(chamado, messageText, clienteEmail, registroIndex);
  } catch (err) {
    console.warn('[emailNotification] notifyAgentReply:', (err as Error).message);
  }
}
