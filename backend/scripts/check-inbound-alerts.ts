/** check-inbound-alerts.ts v1.0.0 — alertas Twilio + detalhe das inbound recentes */
import { env } from '../src/config/env';

const DESK = 'whatsapp:+17406933944';

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

async function main() {
  const sid = env.twilioAccountSid.trim();

  console.log('=== Inbound recentes PARA o sender Desk ===');
  const msgs = await api(
    'https://api.twilio.com',
    `/2010-04-01/Accounts/${sid}/Messages.json?To=${encodeURIComponent(DESK)}&PageSize=10`,
  );
  for (const m of msgs.data.messages ?? []) {
    console.log(JSON.stringify({
      sid: m.sid,
      date: m.date_sent,
      from: m.from,
      to: m.to,
      direction: m.direction,
      status: m.status,
      body: (m.body ?? '').slice(0, 60),
      messaging_service_sid: m.messaging_service_sid,
      error_code: m.error_code,
    }));
  }

  console.log('\n=== Alertas Twilio (ultimos) ===');
  const alerts = await api('https://monitor.twilio.com', '/v1/Alerts?PageSize=20');
  for (const a of alerts.data.alerts ?? []) {
    console.log(JSON.stringify({
      date: a.date_created,
      errorCode: a.error_code,
      level: a.log_level,
      resource: a.resource_sid,
      text: String(a.alert_text ?? '').slice(0, 160),
      requestUrl: a.request_url,
      responseStatus: a.response_status_code,
    }));
  }
}

main().catch(console.error);
