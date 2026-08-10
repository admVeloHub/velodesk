/** list-whatsapp-template-approvals.ts v1.0.0 */
import { env } from '../src/config/env';

async function main() {
  const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  const res = await fetch('https://content.twilio.com/v1/Content?PageSize=15', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  const items = data.contents ?? [];
  for (const item of items) {
    const sid = item.sid;
    const appr = await fetch(`https://content.twilio.com/v1/Content/${sid}/ApprovalRequests`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const apprData = await appr.json();
    const wa = (apprData.whatsapp ?? apprData.approval_requests ?? []) as Array<{ status?: string; category?: string; name?: string }>;
    const waInfo = Array.isArray(wa) ? wa[0] : apprData.whatsapp;
    console.log(
      sid,
      '|',
      item.friendly_name,
      '|',
      waInfo?.category ?? waInfo?.status ?? JSON.stringify(apprData).slice(0, 80),
    );
  }
}

main().catch(console.error);
