/** check-recent-wa-send.ts v1.0.0 — últimos envios WA Desk + Twilio */
import mongoose from 'mongoose';
import { env, cleanMongoUri } from '../src/config/env';
import { getTwilioClient } from '../src/services/twilio/twilioClient.util';
import { ChamadoN1 } from '../src/models/ChamadoN1';

async function main() {
  const uri = cleanMongoUri(env.mongoUri);
  if (!uri) throw new Error('MONGODB_URI ausente');
  await mongoose.connect(uri);

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  console.log('=== Mongo: mensagens WA agente (últimas 2h) ===');
  const chamados = await ChamadoN1.find({
    'registro.metadados.whatsappMensagens': { $exists: true },
    updatedAt: { $gte: since },
  })
    .sort({ updatedAt: -1 })
    .limit(10)
    .lean();

  if (!chamados.length) {
    console.log('(nenhum chamado atualizado nas últimas 2h com whatsappMensagens)');
  }

  for (const c of chamados) {
    const regs = (c.registro ?? []) as Array<{ metadados?: Record<string, unknown> }>;
    for (const reg of regs) {
      const list = reg.metadados?.whatsappMensagens as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(list)) continue;
      for (const msg of list) {
        const data = String(msg.data ?? '');
        if (data && new Date(data) < since) continue;
        if (msg.origin !== 'agente') continue;
        console.log(JSON.stringify({
          protocolo: c.chamadoProtocolo,
          id: c._id,
          data: msg.data,
          texto: String(msg.texto ?? '').slice(0, 80),
          sid: msg.twilioMessageSid,
          status: msg.deliveryStatus,
          err: msg.deliveryErrorCode,
        }));
      }
    }
  }

  console.log('\n=== Twilio: mensagens para +5515992382865 (últimas 10) ===');
  const client = getTwilioClient();
  const toTest = await client.messages.list({
    to: 'whatsapp:+5515992382865',
    limit: 10,
  });
  for (const m of toTest) {
    console.log(
      `${m.dateCreated?.toISOString()} | ${m.status} | err=${m.errorCode ?? '-'} | sid=${m.sid} | ${String(m.body ?? '').slice(0, 60)}`,
    );
  }

  console.log('\n=== Twilio: outbound desk sender (últimas 20, filtrando não-verificação) ===');
  const desk = await client.messages.list({ from: 'whatsapp:+17406933944', limit: 30 });
  let count = 0;
  for (const m of desk) {
    const body = String(m.body ?? '');
    if (body.includes('código de verificação')) continue;
    console.log(
      `${m.dateCreated?.toISOString()} | ${m.status} | err=${m.errorCode ?? '-'} | ${m.to} | ${body.slice(0, 60)}`,
    );
    count += 1;
    if (count >= 10) break;
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
