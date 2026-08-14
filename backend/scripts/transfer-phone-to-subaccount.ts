/** transfer-phone-to-subaccount.ts v1.0.0 — transfere numero PN para subconta Velodesk */
import { env } from '../src/config/env';

const PHONE_PN = 'PN88c0a28713a855c163acc581ee26c2f8';

async function main() {
  const mainSid = env.twilioAccountSid.trim();
  const mainToken = env.twilioAuthToken.trim();
  const SUBACCOUNT_SID = env.twilioSubaccountSid.trim();

  if (!mainSid || !mainToken) {
    console.error('Defina TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN da conta principal.');
    process.exit(1);
  }

  if (!SUBACCOUNT_SID) {
    console.error('Defina TWILIO_SUBACCOUNT_SID (destino da transferencia).');
    process.exit(1);
  }

  const auth = Buffer.from(`${mainSid}:${mainToken}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${mainSid}/IncomingPhoneNumbers/${PHONE_PN}.json`;

  console.log('Transferindo numero para subconta Velodesk...');
  console.log('Phone PN:', PHONE_PN);
  console.log('Destino subconta:', SUBACCOUNT_SID);
  console.log('');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ AccountSid: SUBACCOUNT_SID }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error('Falha HTTP', res.status);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const d = data as Record<string, unknown>;
  console.log('Transferencia concluida.');
  console.log(JSON.stringify({
    sid: d.sid,
    phoneNumber: d.phone_number,
    friendlyName: d.friendly_name,
    accountSid: d.account_sid,
  }, null, 2));

  if (d.account_sid !== SUBACCOUNT_SID) {
    console.warn('Atencao: account_sid retornado difere da subconta esperada.');
  }
}

main().catch((err) => {
  console.error('Erro:', (err as Error).message);
  process.exit(1);
});
