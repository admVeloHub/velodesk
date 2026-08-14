/** check-conversations-address.ts v1.0.0 — Address Configuration Conversations (captura inbound) */
import { env } from '../src/config/env';

async function api(base: string, path: string) {
  const auth = Buffer.from(
    `${env.twilioAccountSid.trim()}:${env.twilioAuthToken.trim()}`,
  ).toString('base64');
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Basic ${auth}` } });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function main() {
  console.log('=== Conversations: Address Configurations ===');
  const addr = await api('https://conversations.twilio.com', '/v1/Configuration/Addresses?PageSize=50');
  if (!addr.ok) {
    console.log('HTTP', addr.status, addr.data);
  } else {
    const items = addr.data.addresses ?? [];
    if (!items.length) console.log('(nenhuma address configuration)');
    for (const a of items) {
      console.log(JSON.stringify({
        sid: a.sid,
        type: a.type,
        address: a.address,
        friendlyName: a.friendly_name,
        autoCreationEnabled: a.auto_creation?.enabled,
        autoCreationType: a.auto_creation?.type,
        webhookUrl: a.auto_creation?.webhook_url,
        webhookMethod: a.auto_creation?.webhook_method,
        webhookFilters: a.auto_creation?.webhook_filters,
      }, null, 2));
    }
  }

  console.log('\n=== Conversations recentes ===');
  const convs = await api('https://conversations.twilio.com', '/v1/Conversations?PageSize=5');
  if (!convs.ok) {
    console.log('HTTP', convs.status, convs.data);
  } else {
    for (const c of convs.data.conversations ?? []) {
      console.log(JSON.stringify({
        sid: c.sid,
        friendlyName: c.friendly_name,
        state: c.state,
        dateCreated: c.date_created,
      }));
    }
  }

  console.log('\n=== Conversations global webhooks ===');
  const wh = await api('https://conversations.twilio.com', '/v1/Configuration/Webhooks');
  console.log(JSON.stringify(wh.data, null, 2));
}

main().catch(console.error);
