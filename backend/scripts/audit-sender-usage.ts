/** audit-sender-usage.ts v1.0.0 — uso real de cada WhatsApp sender nas ultimas 24h */
import { env } from '../src/config/env';

async function main() {
  const sid = env.twilioAccountSid.trim();
  const auth = Buffer.from(`${sid}:${env.twilioAuthToken.trim()}`).toString('base64');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let url = `/2010-04-01/Accounts/${sid}/Messages.json?PageSize=1000&DateSent>=${since}`;

  type Stat = { out: number; in: number; services: Set<string>; sample: string };
  const stats = new Map<string, Stat>();
  let pages = 0;

  while (url && pages < 8) {
    const res = await fetch(`https://api.twilio.com${url}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await res.json();
    for (const m of data.messages ?? []) {
      const isIn = m.direction === 'inbound';
      const key = isIn ? m.to : m.from;
      if (!key || !String(key).startsWith('whatsapp:')) continue;
      const cur = stats.get(key) ?? { out: 0, in: 0, services: new Set<string>(), sample: '' };
      if (isIn) cur.in += 1;
      else {
        cur.out += 1;
        if (!cur.sample) cur.sample = String(m.body ?? '').slice(0, 45);
      }
      if (m.messaging_service_sid) cur.services.add(m.messaging_service_sid);
      stats.set(key, cur);
    }
    url = data.next_page_uri;
    pages += 1;
  }

  console.log(`=== Uso por sender WhatsApp desde ${since} (paginas lidas: ${pages}) ===\n`);
  for (const [k, v] of [...stats].sort((a, b) => b[1].out - a[1].out)) {
    console.log(JSON.stringify({
      sender: k,
      outbound: v.out,
      inbound: v.in,
      messagingServices: [...v.services],
      amostraOutbound: v.sample,
    }));
  }
}

main().catch(console.error);
