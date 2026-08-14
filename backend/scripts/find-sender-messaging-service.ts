/** find-sender-messaging-service.ts v1.1.0 — Messaging Services: PhoneNumbers + ChannelSenders */
import { env } from '../src/config/env';

const DESK_DIGITS = '17406933944';

async function api(base: string, path: string) {
  const auth = Buffer.from(
    `${env.twilioAccountSid.trim()}:${env.twilioAuthToken.trim()}`,
  ).toString('base64');
  const res = await fetch(`${base}${path}`, {
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
  const services = await api('https://messaging.twilio.com', '/v1/Services?PageSize=50');
  const list = services.data.services ?? [];
  console.log(`Messaging Services: ${list.length}\n`);

  for (const s of list) {
    const phones = await api('https://messaging.twilio.com', `/v1/Services/${s.sid}/PhoneNumbers?PageSize=100`);
    const channels = await api('https://messaging.twilio.com', `/v1/Services/${s.sid}/ChannelSenders?PageSize=100`);

    const phoneList = (phones.data.phone_numbers ?? []).map(
      (p: { phone_number: string }) => p.phone_number,
    );
    const channelList = (channels.data.channel_senders ?? []).map(
      (c: { sender?: string; sid?: string }) => c.sender ?? c.sid,
    );

    const all = [...phoneList, ...channelList].map(String);
    const hasDesk = all.some((x) => x.replace(/\D/g, '').includes(DESK_DIGITS));

    console.log(JSON.stringify({
      sid: s.sid,
      name: s.friendly_name,
      inbound_request_url: s.inbound_request_url,
      use_inbound_webhook_on_number: s.use_inbound_webhook_on_number,
      phoneNumbers: phoneList,
      channelSenders: channelList,
      hasDesk,
    }, null, 2));
    if (hasDesk) console.log('>>> CONTEM O SENDER DESK <<<\n');
  }
}

main().catch(console.error);
