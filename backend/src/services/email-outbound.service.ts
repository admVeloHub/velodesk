/** email-outbound.service v1.1.0 — Gmail API via desk_config */
import { sendViaGmailApi } from './gmail/gmailApiSend';
import {
  getEffectiveFromAddress,
  getEmailTransportSnapshot,
  isEmailTransportReady,
} from './emailTransport.service';

export interface OutboundEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface OutboundEmailResult {
  sent: boolean;
  reason?: string;
}

export function buildProtocolSubject(protocolo: string, titulo: string): string {
  return `[${protocolo}] ${titulo}`.trim();
}

function wrapTextAsHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333">${escaped}</div>`;
}

export async function sendOutboundEmail(payload: OutboundEmailPayload): Promise<OutboundEmailResult> {
  if (!isEmailTransportReady()) {
    return { sent: false, reason: 'Gmail API não configurado (desk_config.email_transport)' };
  }

  const snap = getEmailTransportSnapshot();
  if (!snap) {
    return { sent: false, reason: 'Snapshot de transporte ausente' };
  }

  const to = String(payload.to ?? '').trim();
  if (!to.includes('@')) {
    return { sent: false, reason: 'Destinatário inválido' };
  }

  try {
    await sendViaGmailApi(
      {
        serviceAccountJson: snap.serviceAccountJson,
        delegatedUserEmail: snap.delegatedUserEmail,
      },
      {
        from: getEffectiveFromAddress(),
        to,
        subject: payload.subject,
        html: payload.html ?? wrapTextAsHtml(payload.text),
      }
    );
    return { sent: true };
  } catch (err) {
    const reason = (err as Error).message;
    console.error('[email-outbound]', reason);
    return { sent: false, reason };
  }
}
