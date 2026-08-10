/** check-twilio-sender-webhook.ts v1.0.0 */
import { env } from '../src/config/env';

async function main() {
  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const url = 'https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=20';
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  const data = await res.json();
  if (!res.ok) {
    console.error('HTTP', res.status, data);
    process.exit(1);
  }
  const senders = data.senders ?? data.results ?? data;
  console.log(JSON.stringify(senders, null, 2));
}

main().catch(console.error);
