/** test-whatsapp-send.ts v1.0.0 — quickstart Twilio Sandbox (template Appointment Reminder) */
import { isTwilioConfigured } from '../src/services/twilio/twilioClient.util';
import { sendWhatsAppSandboxTemplate } from '../src/services/twilio/whatsappOutbound.service';
import { env } from '../src/config/env';

async function main() {
  const to = String(process.env.TEST_WHATSAPP_TO ?? '').trim();
  if (!to) {
    console.error('Defina TEST_WHATSAPP_TO com seu número WhatsApp em E.164.');
    console.error('Ex.: $env:TEST_WHATSAPP_TO="+5511999990000"; npm run test:whatsapp-send');
    process.exit(1);
  }

  if (!isTwilioConfigured()) {
    console.error('Twilio não configurado. Defina TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN.');
    process.exit(1);
  }

  console.log(`Enviando template Sandbox de ${env.twilioWhatsappFrom} → whatsapp:${to.replace(/^whatsapp:/, '')} ...`);

  const result = await sendWhatsAppSandboxTemplate({
    to,
    contentVariables: {
      1: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      2: new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }),
    },
  });

  if (!result.sent) {
    console.error('Falha:', result.reason);
    process.exit(1);
  }

  console.log('Enviado com sucesso.');
  console.log('SID:', result.sid);
  if (result.body) console.log('Body:', result.body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
