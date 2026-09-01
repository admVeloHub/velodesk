/** configure-whatsapp-sender-2138453583.ts v1.0.0 — webhooks + MS Customer Care */
import { env } from '../src/config/env';
import {
  resolveWhatsAppInboundWebhookUrl,
  resolveWhatsAppStatusCallbackUrl,
} from '../src/services/twilio/whatsappCallbackUrl.util';

const PROD_BASE = 'https://velodesk-278491073220.us-east1.run.app';
const SENDER_SID = 'XEe178605a49832109f8978d4769415888';
const MS_SID = 'MGdaa366a6c5408671f36da45038ef2fce';

async function twilioFetch(url: string, init?: RequestInit) {
  const accountSid = env.twilioAccountSid.trim();
  const authToken = env.twilioAuthToken.trim();
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
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

async function main() {
  const inboundUrl = resolveWhatsAppInboundWebhookUrl(PROD_BASE);
  const statusUrl = resolveWhatsAppStatusCallbackUrl(PROD_BASE);

  console.log('Sender SID:', SENDER_SID);
  console.log('Messaging Service:', MS_SID);
  console.log('Inbound:', inboundUrl);
  console.log('Status:', statusUrl);
  console.log('');

  const senderRes = await twilioFetch(`https://messaging.twilio.com/v2/Channels/Senders/${SENDER_SID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      webhook: {
        callback_url: inboundUrl,
        callback_method: 'POST',
        status_callback_url: statusUrl,
        status_callback_method: 'POST',
      },
    }),
  });
  if (!senderRes.ok) {
    console.error('Falha webhook sender', senderRes.status, senderRes.data);
    process.exit(1);
  }
  console.log('Sender atualizado:', JSON.stringify(senderRes.data, null, 2));

  const linkRes = await twilioFetch(
    `https://messaging.twilio.com/v1/Services/${MS_SID}/ChannelSenders`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Sid: SENDER_SID }),
    },
  );
  console.log('\nVinculo MS (HTTP', linkRes.status + '):', JSON.stringify(linkRes.data, null, 2));

  const msRes = await twilioFetch(`https://messaging.twilio.com/v1/Services/${MS_SID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ UseInboundWebhookOnNumber: 'true' }),
  });
  console.log('\nMS use_inbound_webhook_on_number (HTTP', msRes.status + '):', JSON.stringify(msRes.data, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
