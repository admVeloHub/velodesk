/** enable-ms-inbound-on-number.ts v1.0.0 */
import { env } from '../src/config/env';

const MS_AUTH_SID = 'MG05661f5d68fc5725b9426442599503ad';

async function main() {
  const auth = Buffer.from(
    `${env.twilioAccountSid.trim()}:${env.twilioAuthToken.trim()}`,
  ).toString('base64');

  const res = await fetch(`https://messaging.twilio.com/v1/Services/${MS_AUTH_SID}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ UseInboundWebhookOnNumber: 'true' }),
  });

  const text = await res.text();
  console.log('HTTP', res.status);
  console.log(text);
}

main().catch(console.error);
