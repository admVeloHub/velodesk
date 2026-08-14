/** inspect-desk-sender.ts v1.0.0 — detalhe sender + messaging services */
import { env } from '../src/config/env';

const DESK_SENDER_SID = 'XE1e67288e9be3423725eb522bfd0609fa';

async function main() {
  const accountSid = env.twilioAccountSid.trim();
  const authToken = env.twilioAuthToken.trim();
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const senderRes = await fetch(
    `https://messaging.twilio.com/v2/Channels/Senders/${DESK_SENDER_SID}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  console.log('=== Sender GET ===');
  console.log(JSON.stringify(await senderRes.json(), null, 2));

  const servicesRes = await fetch(
    'https://messaging.twilio.com/v1/Services?PageSize=20',
    { headers: { Authorization: `Basic ${auth}` } },
  );
  const services = await servicesRes.json();
  console.log('\n=== Messaging Services ===');
  for (const s of services.services ?? []) {
    console.log(JSON.stringify({
      sid: s.sid,
      friendlyName: s.friendly_name,
      inboundRequestUrl: s.inbound_request_url,
      inboundMethod: s.inbound_method,
      statusCallback: s.status_callback,
    }));
  }
}

main().catch(console.error);
