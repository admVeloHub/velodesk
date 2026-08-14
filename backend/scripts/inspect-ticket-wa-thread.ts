/** inspect-ticket-wa-thread.ts v1.0.0 — inspeciona thread WhatsApp de tickets (prod) */
import fs from 'fs';
import path from 'path';
import os from 'os';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const TICKET_NEW = '6a7b6bd242a94dab97aacf63';
const TICKET_OPEN = '6a7a4f8c2840718a227bfb7b';
const PHONE_SUFFIX = '97995634';

async function main() {
  const uriFile = path.join(os.tmpdir(), 'prod_mongo_uri.txt');
  const uri = fs.readFileSync(uriFile, 'utf8').trim();
  await mongoose.connect(uri, { dbName: 'b2c_chamados' });
  const col = mongoose.connection.collection('chamados_n1');

  for (const id of [TICKET_NEW, TICKET_OPEN]) {
    const doc = await col.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!doc) {
      console.log(`\n=== Ticket ${id}: NAO ENCONTRADO ===`);
      continue;
    }
    console.log(`\n=== Ticket ${id} | protocolo ${doc.chamadoProtocolo} ===`);
    console.log('status:', doc.chamadoStatus, '| cliente:', doc.clienteNome ?? doc.cliente ?? '?');
    console.log('updatedAt:', doc.updatedAt);
    const registros = (doc.registro ?? []) as Array<Record<string, unknown>>;
    console.log('registros:', registros.length);
    registros.forEach((reg, i) => {
      const md = (reg.metadados ?? {}) as Record<string, unknown>;
      const msgs = (md.whatsappMensagens ?? []) as Array<Record<string, unknown>>;
      const info: Record<string, unknown> = {
        idx: i,
        origem: reg.origem ?? reg.canal ?? null,
        source: md.source ?? null,
        waChatId: md.waChatId ?? null,
        waFrom: md.waFrom ?? null,
        numMsgs: msgs.length,
      };
      console.log(JSON.stringify(info));
      for (const m of msgs.slice(-6)) {
        console.log('   ', JSON.stringify({
          origin: m.origin,
          autor: m.autor,
          texto: String(m.texto ?? '').slice(0, 50),
          criadoEm: m.criadoEm,
          sid: m.twilioMessageSid,
        }));
      }
    });
  }

  console.log('\n=== Tickets recentes com o numero (sufixo 97995634) ===');
  const cursor = col.find({
    $or: [
      { 'registro.metadados.waChatId': { $regex: `${PHONE_SUFFIX}$` } },
      { 'registro.metadados.waFrom': { $regex: `${PHONE_SUFFIX}$` } },
    ],
  }).sort({ updatedAt: -1 }).limit(10);
  for await (const doc of cursor) {
    console.log(JSON.stringify({
      id: String(doc._id),
      protocolo: doc.chamadoProtocolo,
      status: doc.chamadoStatus,
      updatedAt: doc.updatedAt,
    }));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
