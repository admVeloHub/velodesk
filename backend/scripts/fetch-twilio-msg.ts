import { getTwilioClient } from '../src/services/twilio/twilioClient.util';

async function main() {
  const sid = process.argv[2] || 'MMe2df9bb24896fbf5cf9d3ff4568e90f3';
  const client = getTwilioClient();
  const m = await client.messages(sid).fetch();
  console.log(JSON.stringify({
    sid: m.sid,
    status: m.status,
    errorCode: m.errorCode,
    errorMessage: m.errorMessage,
    to: m.to,
    from: m.from,
    dateCreated: m.dateCreated,
    body: m.body,
  }, null, 2));
}

main().catch(console.error);
