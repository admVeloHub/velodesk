/** twilio-monitor-events.ts v1.0.0 — eventos/alertas webhook Twilio recentes */
import { env } from '../src/config/env';
import { getTwilioClient } from '../src/services/twilio/twilioClient.util';

async function main() {
  const client = getTwilioClient();
  const since = new Date(Date.now() - 3 * 60 * 60 * 1000);

  console.log('=== Alerts (Monitor) ===');
  try {
    const alerts = await client.monitor.v1.alerts.list({ limit: 20 });
    for (const a of alerts) {
      if (a.dateCreated && a.dateCreated < since) continue;
      console.log(JSON.stringify({
        date: a.dateCreated?.toISOString(),
        errorCode: a.errorCode,
        alertText: a.alertText,
        logLevel: a.logLevel,
        moreInfo: a.moreInfo,
      }));
    }
  } catch (err) {
    console.log('Alerts:', (err as Error).message);
  }

  console.log('\n=== Messages inbound recentes to +17406933944 ===');
  const inbound = await client.messages.list({ to: 'whatsapp:+17406933944', limit: 5 });
  for (const m of inbound) {
    console.log(JSON.stringify({
      sid: m.sid,
      date: m.dateCreated?.toISOString(),
      from: m.from,
      body: String(m.body ?? '').slice(0, 60),
      status: m.status,
      accountSid: m.accountSid,
    }));
  }

  console.log('\n=== Account SID local ===');
  console.log('parent:', env.twilioAccountSid);
  console.log('sub:', env.twilioSubaccountSid);
  console.log('credential mode from client');
}

main().catch(console.error);
