/** test-whatsapp-template-prod.ts v1.0.0 — envia template aprovado (não sandbox) */
import { getTwilioClient } from '../src/services/twilio/twilioClient.util';
import { sendWhatsAppSandboxTemplate } from '../src/services/twilio/whatsappOutbound.service';

const TO = process.env.TEST_WHATSAPP_TO ?? '+5515992382865';
const CONTENT_SID = process.env.TEST_WHATSAPP_CONTENT_SID ?? 'HX3a89d76844bed6009d3d6263628136e0';

async function main() {
  console.log(`Template ${CONTENT_SID} → ${TO}`);
  const result = await sendWhatsAppSandboxTemplate({
    to: TO,
    contentSid: CONTENT_SID,
    contentVariables: { 1: 'Teste Velodesk' },
  });
  console.log('send:', result);
  if (!result.sid) process.exit(1);

  await new Promise((r) => setTimeout(r, 8000));
  const msg = await getTwilioClient().messages(result.sid).fetch();
  console.log('final status:', msg.status, '| error:', msg.errorCode, msg.errorMessage);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
