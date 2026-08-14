/** list-all-channel-senders.ts v1.0.0 — lista todos os WhatsApp senders e seus webhooks */
import { env } from '../src/config/env';

async function api(path: string) {
  const auth = Buffer.from(
    `${env.twilioAccountSid.trim()}:${env.twilioAuthToken.trim()}`,
  ).toString('base64');
  const res = await fetch(`https://messaging.twilio.com${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function main() {
  const res = await api('/v2/Channels/Senders?Channel=whatsapp&PageSize=50');
  if (!res.ok) {
    console.log('HTTP', res.status, JSON.stringify(res.data));
    return;
  }
  const senders = res.data.senders ?? [];
  console.log(`Total senders: ${senders.length}\n`);
  for (const s of senders) {
    console.log(JSON.stringify({
      sid: s.sid,
      sender_id: s.sender_id,
      status: s.status,
      webhook: s.webhook,
      profile_name: s.profile?.name,
      configuration: s.configuration,
    }, null, 2));
    console.log('---');
  }
}

main().catch(console.error);
