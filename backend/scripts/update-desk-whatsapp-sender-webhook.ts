/** update-desk-whatsapp-sender-webhook.ts v1.1.0 — POST inbound + status callback no sender Desk */
import { env } from '../src/config/env';
import {
  resolveWhatsAppInboundWebhookUrl,
  resolveWhatsAppStatusCallbackUrl,
} from '../src/services/twilio/whatsappCallbackUrl.util';

const DESK_SENDER_SID = 'XE1e67288e9be3423725eb522bfd0609fa';
const PROD_BASE = 'https://velodesk-278491073220.us-east1.run.app';

async function main() {
  const inboundUrl = resolveWhatsAppInboundWebhookUrl(PROD_BASE);
  const statusUrl = resolveWhatsAppStatusCallbackUrl(PROD_BASE);
  const accountSid = env.twilioAccountSid.trim();
  const authToken = env.twilioAuthToken.trim();
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN ausentes');
  }

  const body = {
    webhook: {
      callback_url: inboundUrl,
      callback_method: 'POST',
      status_callback_url: statusUrl,
      status_callback_method: 'POST',
    },
  };

  console.log('Atualizando sender', DESK_SENDER_SID);
  console.log(JSON.stringify(body, null, 2));

  const url = `https://messaging.twilio.com/v2/Channels/Senders/${DESK_SENDER_SID}`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('HTTP', res.status, data);
    process.exit(1);
  }

  console.log(JSON.stringify({
    sid: data.sid,
    sender_id: data.sender_id,
    webhook: data.webhook,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
