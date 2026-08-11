/** configure-desk-whatsapp-sender.ts v1.0.0 — webhook sender + MS use_inbound_webhook_on_number */
import { env } from '../src/config/env';
import {
  resolveWhatsAppInboundWebhookUrl,
  resolveWhatsAppStatusCallbackUrl,
} from '../src/services/twilio/whatsappCallbackUrl.util';

const PROD_BASE = 'https://velodesk-278491073220.us-east1.run.app';
const MS_AUTH_SID = 'MG05661f5d68fc5725b9426442599503ad';

function digitsFromWhatsApp(from: string): string {
  return String(from).replace(/^whatsapp:/i, '').replace(/\D/g, '');
}

async function twilioFetch(path: string, init?: RequestInit) {
  const accountSid = env.twilioAccountSid.trim();
  const authToken = env.twilioAuthToken.trim();
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(`https://messaging.twilio.com${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { ok: res.ok, status: res.status, data };
}

async function findSenderSid(senderDigits: string): Promise<string> {
  const res = await twilioFetch('/v2/Channels/Senders?Channel=whatsapp&PageSize=50');
  if (!res.ok) throw new Error(`Falha ao listar senders HTTP ${res.status}`);
  const senders = (res.data as { senders?: Array<{ sid?: string; sender_id?: string }> }).senders ?? [];
  const match = senders.find((s) => digitsFromWhatsApp(String(s.sender_id ?? '')).includes(senderDigits));
  if (!match?.sid) {
    throw new Error(`Sender whatsapp:+${senderDigits} nao encontrado na conta`);
  }
  return match.sid;
}

async function main() {
  const from = env.twilioWhatsappFrom.trim();
  const senderDigits = digitsFromWhatsApp(from);
  if (!senderDigits) {
    throw new Error('TWILIO_WHATSAPP_FROM ausente ou invalido');
  }

  const inboundUrl = resolveWhatsAppInboundWebhookUrl(PROD_BASE);
  const statusUrl = resolveWhatsAppStatusCallbackUrl(PROD_BASE);
  const senderSid = await findSenderSid(senderDigits);

  console.log('Configurando Desk WhatsApp sender');
  console.log('from:', from);
  console.log('senderSid:', senderSid);
  console.log('inbound:', inboundUrl);
  console.log('status:', statusUrl);
  console.log('');

  const webhookBody = {
    webhook: {
      callback_url: inboundUrl,
      callback_method: 'POST',
      status_callback_url: statusUrl,
      status_callback_method: 'POST',
    },
  };

  const senderRes = await twilioFetch(`/v2/Channels/Senders/${senderSid}`, {
    method: 'POST',
    body: JSON.stringify(webhookBody),
  });
  if (!senderRes.ok) {
    console.error('Falha ao atualizar sender HTTP', senderRes.status, senderRes.data);
    process.exit(1);
  }

  const s = senderRes.data as Record<string, unknown>;
  console.log('Sender atualizado:');
  console.log(JSON.stringify({
    sid: s.sid,
    sender_id: s.sender_id,
    webhook: s.webhook,
  }, null, 2));

  console.log('\nAtualizando Messaging Service Autenticacao (use_inbound_webhook_on_number=true)...');
  const msRes = await fetch(`https://messaging.twilio.com/v1/Services/${MS_AUTH_SID}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid.trim()}:${env.twilioAuthToken.trim()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ UseInboundWebhookOnNumber: 'true' }),
  });
  const msData = await msRes.json();
  if (!msRes.ok) {
    console.error('Falha ao atualizar Messaging Service HTTP', msRes.status, msData);
    process.exit(1);
  }

  const ms = msData as Record<string, unknown>;
  console.log('Messaging Service atualizado:');
  console.log(JSON.stringify({
    sid: ms.sid,
    friendly_name: ms.friendly_name,
    use_inbound_webhook_on_number: ms.use_inbound_webhook_on_number,
    inbound_request_url: ms.inbound_request_url,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
