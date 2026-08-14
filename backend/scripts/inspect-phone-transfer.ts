/** inspect-phone-transfer.ts v1.0.0 — inspeciona numero e subcontas para transferencia */
import { env } from '../src/config/env';

const PHONE_PN = 'PN88c0a28713a855c163acc581ee26c2f8';

async function api(base: string, path: string, init?: RequestInit) {
  const sid = env.twilioAccountSid.trim();
  const token = env.twilioAuthToken.trim();
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const mainSid = env.twilioAccountSid.trim();
  const subSid = env.twilioSubaccountSid.trim();

  console.log('Conta principal:', mainSid || '(ausente)');
  console.log('Subconta env:', subSid || '(ausente)');
  console.log('Phone PN:', PHONE_PN);
  console.log('');

  console.log('=== Detalhe do numero ===');
  const pn = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${mainSid}/IncomingPhoneNumbers/${PHONE_PN}.json`,
  );
  if (!pn.ok) {
    console.log('HTTP', pn.status, JSON.stringify(pn.data, null, 2));
  } else {
    const d = pn.data as Record<string, unknown>;
    console.log(JSON.stringify({
      sid: d.sid,
      phoneNumber: d.phone_number,
      friendlyName: d.friendly_name,
      accountSid: d.account_sid,
      smsUrl: d.sms_url,
      voiceUrl: d.voice_url,
      status: d.status,
    }, null, 2));
  }

  console.log('\n=== Subcontas (conta principal) ===');
  const subs = await api(
    'https://api.twilio.com',
    '/2010-04-01/Accounts.json?PageSize=50',
  );
  if (!subs.ok) {
    console.log('HTTP', subs.status, JSON.stringify(subs.data, null, 2));
  } else {
    const list = (subs.data as { accounts?: Array<Record<string, unknown>> }).accounts ?? [];
    for (const a of list) {
      if (a.sid === mainSid) continue;
      console.log(JSON.stringify({
        sid: a.sid,
        friendlyName: a.friendly_name,
        status: a.status,
        ownerAccountSid: a.owner_account_sid,
        isConfiguredSub: subSid && a.sid === subSid,
      }));
    }
    if (list.filter((a) => a.sid !== mainSid).length === 0) console.log('(nenhuma subconta listada)');
  }

  console.log('\n=== WhatsApp senders (conta principal) ===');
  const senders = await api(
    'https://messaging.twilio.com',
    '/v2/Channels/Senders?Channel=whatsapp&PageSize=50',
  );
  if (senders.ok) {
    const items = (senders.data as { senders?: Array<Record<string, unknown>> }).senders ?? [];
    const phone = (pn.data as { phone_number?: string })?.phone_number;
    const match = items.filter((s) => {
      const id = String(s.sender_id ?? '');
      return phone && id.includes(String(phone).replace('+', ''));
    });
    if (!match.length) {
      console.log('Nenhum WhatsApp sender encontrado para este numero na conta principal.');
    } else {
      for (const s of match) {
        console.log(JSON.stringify({
          sid: s.sid,
          sender_id: s.sender_id,
          status: s.status,
          webhook: s.webhook,
        }, null, 2));
      }
    }
  } else {
    console.log('HTTP', senders.status, JSON.stringify(senders.data, null, 2));
  }
}

main().catch(console.error);
