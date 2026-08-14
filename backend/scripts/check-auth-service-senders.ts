/** check-auth-service-senders.ts v1.0.0 — quais numeros usam o MS de Autenticacao */
import { env } from '../src/config/env';

const MS_AUTH = 'MG05661f5d68fc5725b9426442599503ad';

async function main() {
  const sid = env.twilioAccountSid.trim();
  const auth = Buffer.from(`${sid}:${env.twilioAuthToken.trim()}`).toString('base64');

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let url = `/2010-04-01/Accounts/${sid}/Messages.json?PageSize=1000&DateSent>=${since}`;
  const outByFrom = new Map<string, number>();
  const inByTo = new Map<string, number>();
  let pages = 0;

  while (url && pages < 5) {
    const res = await fetch(`https://api.twilio.com${url}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await res.json();
    for (const m of data.messages ?? []) {
      if (m.messaging_service_sid !== MS_AUTH) continue;
      if (m.direction === 'inbound') {
        inByTo.set(m.to, (inByTo.get(m.to) ?? 0) + 1);
      } else {
        outByFrom.set(m.from, (outByFrom.get(m.from) ?? 0) + 1);
      }
    }
    url = data.next_page_uri;
    pages += 1;
  }

  console.log(`=== MS ${MS_AUTH} (Autenticacao) — desde ${since} ===`);
  console.log('\nOUTBOUND por remetente:');
  for (const [k, v] of [...outByFrom].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log('\nINBOUND por destino:');
  for (const [k, v] of [...inByTo].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
}

main().catch(console.error);
