/** create-twilio-subaccount.ts v1.0.0 — cria subconta Twilio (conta principal) */
import { getTwilioParentClient, resolveTwilioParentCredentials } from '../src/services/twilio/twilioClient.util';

async function main() {
  if (!resolveTwilioParentCredentials()) {
    console.error('Defina TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN da conta principal (parent).');
    process.exit(1);
  }

  const friendlyName = String(process.env.TWILIO_SUBACCOUNT_FRIENDLY_NAME ?? 'Velodesk').trim();
  if (!friendlyName) {
    console.error('TWILIO_SUBACCOUNT_FRIENDLY_NAME inválido.');
    process.exit(1);
  }

  console.log(`Criando subconta Twilio: "${friendlyName}" ...`);

  const client = getTwilioParentClient();
  const account = await client.api.v2010.accounts.create({ friendlyName });

  console.log('\nSubconta criada com sucesso.\n');
  console.log('Guarde estes valores em local seguro (FONTE DA VERDADE / secret manager):\n');
  console.log('TWILIO_SUBACCOUNT_SID=' + account.sid);
  console.log('TWILIO_SUBACCOUNT_AUTH_TOKEN=' + account.authToken);
  console.log('\nFriendly name:', account.friendlyName);
  console.log('Status:', account.status);
  console.log('Owner (parent):', account.ownerAccountSid);
}

main().catch((err) => {
  console.error('Falha ao criar subconta:', (err as Error).message);
  process.exit(1);
});
