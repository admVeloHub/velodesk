/** diagnose-whatsapp-send.ts v1.0.0 — status Twilio + teste texto livre */
import { getTwilioClient, getTwilioCredentialMode, getTwilioWhatsAppFrom } from '../src/services/twilio/twilioClient.util';
import { sendWhatsAppTextMessage } from '../src/services/twilio/whatsappOutbound.service';
import { env } from '../src/config/env';

async function fetchStatus(sid: string) {
  const client = getTwilioClient();
  const msg = await client.messages(sid).fetch();
  return {
    sid: msg.sid,
    status: msg.status,
    errorCode: msg.errorCode,
    errorMessage: msg.errorMessage,
    from: msg.from,
    to: msg.to,
    direction: msg.direction,
    dateCreated: msg.dateCreated,
    dateSent: msg.dateSent,
    dateUpdated: msg.dateUpdated,
    body: msg.body,
  };
}

async function main() {
  const to = String(process.env.TEST_WHATSAPP_TO ?? '+5515992382865').trim();
  console.log('Modo credencial:', getTwilioCredentialMode());
  console.log('From:', getTwilioWhatsAppFrom());
  console.log('To:', to);
  console.log('Content SID default:', env.twilioWhatsappContentSid);

  const prevSid = String(process.env.TEST_WHATSAPP_SID ?? 'MM1fb1ec6e370de12739290547c2ca85cf').trim();
  if (prevSid) {
    console.log('\n=== Mensagem anterior ===');
    try {
      console.log(JSON.stringify(await fetchStatus(prevSid), null, 2));
    } catch (err) {
      console.error('Falha ao buscar mensagem anterior:', (err as Error).message);
    }
  }

  console.log('\n=== Envio texto livre ===');
  const textResult = await sendWhatsAppTextMessage({
    to,
    body: `Teste Velodesk — texto livre (${new Date().toLocaleString('pt-BR')})`,
  });
  console.log(JSON.stringify(textResult, null, 2));

  if (textResult.sid) {
    await new Promise((r) => setTimeout(r, 5000));
    console.log('\n=== Status após 5s ===');
    console.log(JSON.stringify(await fetchStatus(textResult.sid), null, 2));
  }

  console.log('\n=== Últimas 5 mensagens outbound ===');
  const client = getTwilioClient();
  const list = await client.messages.list({ to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`, limit: 5 });
  for (const m of list) {
    console.log(`- ${m.dateCreated?.toISOString()} | ${m.status} | ${m.errorCode ?? '-'} | ${m.from} -> ${m.to} | ${String(m.body ?? '').slice(0, 60)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
