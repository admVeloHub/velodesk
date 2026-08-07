/** test-twilio-auth.ts v1.0.0 — valida credenciais Twilio (subconta / API Key) */
import { getTwilioClient, getTwilioCredentialMode, isTwilioConfigured } from '../src/services/twilio/twilioClient.util';
import { env } from '../src/config/env';

async function main() {
  console.log('Modo:', getTwilioCredentialMode() ?? 'não configurado');
  console.log('Subconta SID:', env.twilioSubaccountSid || '(ausente)');
  console.log('API Key SID:', env.twilioApiKeySid ? `${env.twilioApiKeySid.slice(0, 6)}...` : '(ausente)');

  if (!isTwilioConfigured()) {
    console.error('\nTwilio não configurado. Defina API Key ou Auth Token da subconta.');
    process.exit(1);
  }

  const client = getTwilioClient();
  const sid = env.twilioSubaccountSid.trim() || env.twilioAccountSid.trim();

  try {
    const account = await client.api.accounts(sid).fetch();
    console.log('\nOK — autenticação válida');
    console.log('Conta:', account.friendlyName);
    console.log('Status:', account.status);
  } catch (err) {
    console.error('\nERR —', (err as Error).message);
    console.error('\nSe Auth Token falhar mesmo igual ao Console: clique Regenerate na subconta Velodesk,');
    console.error('ou crie API Key (Account → API keys) e use TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET.');
    process.exit(1);
  }
}

main();
