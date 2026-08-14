/** fetch-inbound-reply.ts v1.0.0 — última resposta inbound para número */
import { getTwilioClient } from '../src/services/twilio/twilioClient.util';

async function main() {
  const client = getTwilioClient();
  const toDesk = await client.messages.list({
    to: 'whatsapp:+17406933944',
    limit: 10,
  });
  console.log('=== Inbound to desk sender ===');
  for (const m of toDesk) {
    console.log(JSON.stringify({
      date: m.dateCreated?.toISOString(),
      from: m.from,
      body: m.body,
      sid: m.sid,
      status: m.status,
    }));
  }

  const fromClient = await client.messages.list({
    from: 'whatsapp:+5511966153419',
    limit: 5,
  });
  console.log('\n=== From +5511966153419 ===');
  for (const m of fromClient) {
    console.log(JSON.stringify({
      date: m.dateCreated?.toISOString(),
      to: m.to,
      body: m.body,
      sid: m.sid,
      status: m.status,
      direction: m.direction,
    }));
  }
}

main().catch(console.error);
