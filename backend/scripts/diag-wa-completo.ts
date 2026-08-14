/** diag-wa-completo.ts v1.0.0 — diagnostico completo WhatsApp Desk (Twilio) */
import { env } from '../src/config/env';

const SENDER = 'whatsapp:+17406697857';
const OLD_SENDER = 'whatsapp:+17406933944';

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

function fmtMsg(m: Record<string, unknown>) {
  return JSON.stringify({
    sid: m.sid,
    date: m.date_created,
    from: m.from,
    to: m.to,
    dir: m.direction,
    status: m.status,
    err: m.error_code,
    errMsg: m.error_message,
    body: String(m.body ?? '').slice(0, 70),
  });
}

async function main() {
  const sid = env.twilioAccountSid.trim();

  console.log('===== 1. OUTBOUND do sender NOVO (+17406697857) — hoje =====');
  const out = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${sid}/Messages.json?From=${encodeURIComponent(SENDER)}&PageSize=20`,
  );
  const outMsgs = (out.data.messages ?? []) as Array<Record<string, unknown>>;
  const nonVerify = outMsgs.filter((m) => !String(m.body ?? '').includes('verifica'));
  console.log(`total pagina: ${outMsgs.length} | nao-verificacao: ${nonVerify.length}`);
  for (const m of nonVerify.slice(0, 8)) console.log(fmtMsg(m));
  if (!nonVerify.length && outMsgs.length) {
    console.log('(primeiras 3 de verificacao para referencia)');
    for (const m of outMsgs.slice(0, 3)) console.log(fmtMsg(m));
  }

  console.log('\n===== 2. OUTBOUND do sender ANTIGO (+17406933944) — conferir se algo ainda sai por ele =====');
  const outOld = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${sid}/Messages.json?From=${encodeURIComponent(OLD_SENDER)}&PageSize=20`,
  );
  const outOldMsgs = ((outOld.data.messages ?? []) as Array<Record<string, unknown>>)
    .filter((m) => !String(m.body ?? '').includes('verifica'));
  for (const m of outOldMsgs.slice(0, 5)) console.log(fmtMsg(m));
  if (!outOldMsgs.length) console.log('(nenhuma nao-verificacao)');

  console.log('\n===== 3. INBOUND para o sender NOVO =====');
  const inb = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${sid}/Messages.json?To=${encodeURIComponent(SENDER)}&PageSize=10`,
  );
  for (const m of (inb.data.messages ?? []) as Array<Record<string, unknown>>) console.log(fmtMsg(m));

  console.log('\n===== 4. INBOUND para o sender ANTIGO =====');
  const inbOld = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${sid}/Messages.json?To=${encodeURIComponent(OLD_SENDER)}&PageSize=5`,
  );
  for (const m of (inbOld.data.messages ?? []) as Array<Record<string, unknown>>) console.log(fmtMsg(m));

  console.log('\n===== 5. CONFIG sender novo (webhook) =====');
  const senders = await api(
    'https://messaging.twilio.com',
    '/v2/Channels/Senders?Channel=whatsapp&PageSize=50',
  );
  for (const s of (senders.data.senders ?? []) as Array<Record<string, unknown>>) {
    const id = String(s.sender_id ?? '');
    if (id.includes('17406697857') || id.includes('17406933944')) {
      console.log(JSON.stringify({ sender_id: s.sender_id, status: s.status, webhook: s.webhook }, null, 2));
    }
  }

  console.log('\n===== 6. Messaging Service Autenticacao =====');
  const ms = await api('https://messaging.twilio.com', '/v1/Services/MG05661f5d68fc5725b9426442599503ad');
  const msd = ms.data as Record<string, unknown>;
  console.log(JSON.stringify({
    friendly_name: msd.friendly_name,
    inbound_request_url: msd.inbound_request_url,
    use_inbound_webhook_on_number: msd.use_inbound_webhook_on_number,
  }, null, 2));

  console.log('\n===== 7. ALERTAS Twilio (ultimas 2h) =====');
  const alerts = await api('https://monitor.twilio.com', '/v1/Alerts?PageSize=30');
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const a of (alerts.data.alerts ?? []) as Array<Record<string, unknown>>) {
    if (new Date(String(a.date_created)).getTime() < cutoff) continue;
    console.log(JSON.stringify({
      date: a.date_created,
      code: a.error_code,
      resource: a.resource_sid,
      url: a.request_url,
      respStatus: a.response_status_code,
      text: String(a.alert_text ?? '').slice(0, 140),
    }));
  }
}

main().catch(console.error);
