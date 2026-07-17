/** test-gmail-watch.ts v1.0.0 — valida setup Gmail watch (desk_config + gmail.readonly) */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDeskConfigConnected } from '../src/config/database';
import { loadEmailTransport, isEmailTransportReady } from '../src/services/emailTransport.service';
import { setupGmailWatch, getGmailWatchHealth } from '../src/services/gmail/gmailWatch.service';
import { env } from '../src/config/env';

async function main() {
  if (!env.emailEnabled) {
    console.error('Defina EMAIL_ENABLED=true no .env');
    process.exit(1);
  }

  if (!env.gmailInboundEnabled) {
    console.warn('GMAIL_INBOUND_ENABLED não está true — teste continua se vars estiverem no ambiente.');
  }

  await connectDatabase();

  if (!isDeskConfigConnected()) {
    console.error('desk_config não conectou.');
    process.exit(1);
  }

  await loadEmailTransport();

  if (!isEmailTransportReady()) {
    console.error('email_transport incompleto. Rode: npm run seed:email-transport');
    process.exit(1);
  }

  console.log('Configurando Gmail watch...');
  const result = await setupGmailWatch();

  if (!result) {
    console.error('setupGmailWatch falhou — verifique delegação gmail.readonly no Workspace Admin.');
    process.exit(1);
  }

  const health = await getGmailWatchHealth();
  console.log('OK — watch ativo:', JSON.stringify({ ...health, ...result }, null, 2));

  await disconnectDatabase();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
