/** emailNotification.service v1.0.0 — notificações de ticket via Gmail */
import type { IChamadoN1 } from '../models/ChamadoN1';
import { loadDadosForRef } from './cliente.service';
import { buildProtocolSubject, sendOutboundEmail } from './email-outbound.service';

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

export async function sendTicketOpenedEmail(chamado: IChamadoN1, clienteEmail?: string): Promise<void> {
  const to = clienteEmail ?? (await resolveClienteEmailFromChamado(chamado));
  if (!to) return;

  const protocolo = chamado.chamadoProtocolo;
  const titulo = chamado.chamadoTitulo || protocolo;
  const subject = buildProtocolSubject(protocolo, `Confirmação — ${titulo}`);

  const body = `
    <p>Olá,</p>
    <p>Seu chamado foi registrado com sucesso.</p>
    <p><strong>Protocolo:</strong> ${protocolo}</p>
    <p><strong>Assunto:</strong> ${titulo}</p>
    <p>Para responder, utilize este e-mail mantendo o protocolo no assunto.</p>
  `;

  const result = await sendOutboundEmail({
    to,
    subject,
    text: `Protocolo ${protocolo} — ${titulo}`,
    html: baseTemplate('Chamado registrado', body),
  });

  if (!result.sent) {
    console.warn('[emailNotification] confirmação não enviada:', result.reason);
  }
}

export async function sendAgentReplyEmail(
  chamado: IChamadoN1,
  messageText: string,
  clienteEmail?: string
): Promise<void> {
  const to = clienteEmail ?? (await resolveClienteEmailFromChamado(chamado));
  if (!to || !messageText.trim()) return;

  const protocolo = chamado.chamadoProtocolo;
  const titulo = chamado.chamadoTitulo || protocolo;
  const subject = buildProtocolSubject(protocolo, `Re: ${titulo}`);

  const escaped = messageText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const body = `
    <p>Olá,</p>
    <p>Há uma nova mensagem sobre seu chamado <strong>${protocolo}</strong>:</p>
    <div style="background:#fff;padding:12px;border-left:4px solid #1634FF;margin:12px 0">${escaped}</div>
    <p>Responda este e-mail para continuar o atendimento.</p>
  `;

  const result = await sendOutboundEmail({
    to,
    subject,
    text: messageText,
    html: baseTemplate('Nova mensagem no seu chamado', body),
  });

  if (!result.sent) {
    console.warn('[emailNotification] resposta agente não enviada:', result.reason);
  }
}

/** Fail-soft: não propaga erro */
export function notifyTicketOpenedAsync(chamado: IChamadoN1, clienteEmail?: string): void {
  void sendTicketOpenedEmail(chamado, clienteEmail).catch((err) => {
    console.warn('[emailNotification] notifyTicketOpened:', (err as Error).message);
  });
}

export function notifyAgentReplyAsync(
  chamado: IChamadoN1,
  messageText: string,
  clienteEmail?: string
): void {
  void sendAgentReplyEmail(chamado, messageText, clienteEmail).catch((err) => {
    console.warn('[emailNotification] notifyAgentReply:', (err as Error).message);
  });
}
