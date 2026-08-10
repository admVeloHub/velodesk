/** audit-twilio-whatsapp.ts v1.0.0 — auditoria sender, templates e webhooks */
import { getTwilioClient, getTwilioCredentialMode, getTwilioWhatsAppFrom, isTwilioConfigured } from '../src/services/twilio/twilioClient.util';
import { resolveWhatsAppInboundWebhookUrl, resolveWhatsAppStatusCallbackUrl } from '../src/services/twilio/whatsappCallbackUrl.util';
import { env } from '../src/config/env';

const PROD_BASE = 'https://velodesk-278491073220.us-east1.run.app';

async function main() {
  console.log('=== Config local (backend/.env + fonte) ===');
  console.log('twilioConfigured:', isTwilioConfigured());
  console.log('credentialMode:', getTwilioCredentialMode());
  console.log('from:', getTwilioWhatsAppFrom());
  console.log('contentSid default:', env.twilioWhatsappContentSid);
  console.log('statusCallback (env):', resolveWhatsAppStatusCallbackUrl() || '(vazio)');
  console.log('statusCallback (prod):', resolveWhatsAppStatusCallbackUrl(PROD_BASE));
  console.log('inboundWebhook (prod):', resolveWhatsAppInboundWebhookUrl(PROD_BASE));

  const client = getTwilioClient();

  console.log('\n=== Conta ===');
  const account = await client.api.accounts(env.twilioAccountSid).fetch();
  console.log('name:', account.friendlyName, '| status:', account.status);

  console.log('\n=== Últimas mensagens WA from +17406933944 ===');
  const recent = await client.messages.list({
    from: 'whatsapp:+17406933944',
    limit: 8,
  });
  for (const m of recent) {
    console.log(
      `- ${m.dateCreated?.toISOString()} | ${m.status} | err=${m.errorCode ?? '-'} | ${m.to} | ${String(m.body ?? '').slice(0, 50)}`,
    );
  }

  console.log('\n=== Content templates (primeiros 10) ===');
  try {
    const contents = await client.content.v1.contents.list({ limit: 10 });
    if (!contents.length) {
      console.log('(nenhum — criar template aprovado Meta para sender +17406933944)');
    }
    for (const c of contents) {
      console.log(`- ${c.sid} | ${c.friendlyName ?? '-'} | langs=${JSON.stringify(c.language ?? c.languages ?? '?')}`);
    }
  } catch (err) {
    console.log('Content API:', (err as Error).message);
  }

  console.log('\n=== Inbound recentes (to +17406933944) ===');
  const inbound = await client.messages.list({
    to: 'whatsapp:+17406933944',
    limit: 5,
  });
  if (!inbound.length) console.log('(nenhuma nos últimos registros)');
  for (const m of inbound) {
    console.log(`- ${m.dateCreated?.toISOString()} | ${m.from} | ${String(m.body ?? '').slice(0, 60)}`);
  }

  console.log('\n=== Mensagens para +5515992382865 (últimas 5) ===');
  const toTest = await client.messages.list({
    to: 'whatsapp:+5515992382865',
    limit: 5,
  });
  for (const m of toTest) {
    console.log(`- ${m.dateCreated?.toISOString()} | ${m.status} | err=${m.errorCode ?? '-'} | from=${m.from}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
