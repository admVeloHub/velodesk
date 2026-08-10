/** inspect-whatsapp-template.ts v1.0.0 */
import { env } from '../src/config/env';

const sid = process.argv[2] || 'HX4ea29fd42981ca0c06faa64ad7da3195';

async function main() {
  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const res = await fetch(`https://content.twilio.com/v1/Content/${sid}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}

main().catch(console.error);
