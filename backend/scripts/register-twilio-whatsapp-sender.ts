/** register-twilio-whatsapp-sender.ts v1.0.0 — Senders API na subconta Velodesk */
import {
  getWhatsAppSenderRegistrationDefaults,
  registerWhatsAppSender,
} from '../src/services/twilio/whatsappSenderRegistration.service';
import { getTwilioCredentialMode, isTwilioConfigured } from '../src/services/twilio/twilioClient.util';

async function main() {
  if (!isTwilioConfigured()) {
    console.error('Twilio não configurado — verifique TWILIO_SUBACCOUNT_* ou TWILIO_ACCOUNT_*.');
    process.exit(1);
  }

  const defaults = getWhatsAppSenderRegistrationDefaults();
  console.log('Registrando WhatsApp sender (Senders API)...');
  console.log('Conta:', getTwilioCredentialMode() ?? 'desconhecida');
  console.log('sender_id:', defaults.senderId);
  console.log('webhook:', defaults.webhookUrl);
  console.log('profile.name:', defaults.profileName);
  console.log('');
  console.log('Nota: o 1º sender pode exigir Self Sign-up no Console Twilio antes da API.');
  console.log('Número non-Twilio: Meta envia OTP por SMS/voz — conclua verificação se solicitado.');
  console.log('');

  const result = await registerWhatsAppSender();

  console.log('Sender registrado / solicitação enviada.');
  console.log('SID:', result.sid);
  if (result.status) console.log('Status:', result.status);
  console.log('\nResposta completa:');
  console.log(JSON.stringify(result.raw, null, 2));
}

main().catch((err) => {
  const message = (err as Error).message || String(err);
  console.error('Falha ao registrar sender:', message);
  if (/first sender|self sign|signup|console/i.test(message)) {
    console.error('\nPróximo passo: registre o primeiro sender em');
    console.error('https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders');
  }
  process.exit(1);
});
