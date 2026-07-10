/**
 * migrate-sequence-counters.ts v1.0.0
 * Move sequence_counters de desk_config → b2c_chamados e remove a collection legada.
 *
 * Uso: npm run migrate:sequence-counters
 * Dry-run: npm run migrate:sequence-counters -- --dry-run
 */
import mongoose from 'mongoose';
import {
  connectDatabase,
  disconnectDatabase,
  getDeskConfigConnection,
} from '../src/config/database';
import { env } from '../src/config/env';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { formatProtocolo } from '../src/services/protocolo.service';

const SEQUENCE_ID = 'chamadoProtocolo';
const LEGACY_COLLECTION = 'sequence_counters';

type CounterDoc = { _id: string; value: number };

function sequenceFloor(): number {
  const parsed = Number.parseInt(String(env.ticketSequenceFloor || '100177678'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100177678;
}

async function scanMaxNumericProtocol(): Promise<number> {
  const rows = await ChamadoN1.aggregate<{ protocolNum: number }>([
    { $match: { chamadoProtocolo: { $regex: /^\d+$/ } } },
    { $addFields: { protocolNum: { $toLong: '$chamadoProtocolo' } } },
    { $sort: { protocolNum: -1 } },
    { $limit: 1 },
  ]);
  const top = rows[0]?.protocolNum;
  return Number.isFinite(top) && top > 0 ? top : 0;
}

async function listCounterDocs(dbName: string, coll: mongoose.mongo.Collection<CounterDoc>) {
  const docs = await coll.find({}).toArray();
  console.log(`  ${dbName}.${LEGACY_COLLECTION}: ${docs.length} documento(s)`);
  for (const doc of docs) {
    console.log(`    _id=${doc._id} value=${doc.value}`);
  }
  return docs;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('--- Migração sequence_counters ---');
  console.log(`Origem: ${env.mongoDeskConfigDbName}.${LEGACY_COLLECTION}`);
  console.log(`Destino: ${env.mongoDbName}.${LEGACY_COLLECTION}`);
  console.log(`Modo: ${dryRun ? 'dry-run (sem gravar)' : 'execução'}`);

  await connectDatabase();

  const chamadosColl = mongoose.connection.collection<CounterDoc>(LEGACY_COLLECTION);
  const deskConfigColl = getDeskConfigConnection().collection<CounterDoc>(LEGACY_COLLECTION);

  console.log('\nEstado atual:');
  const legacyDocs = await listCounterDocs(env.mongoDeskConfigDbName, deskConfigColl);
  const targetDocs = await listCounterDocs(env.mongoDbName, chamadosColl);

  const maxInDb = await scanMaxNumericProtocol();
  const floor = sequenceFloor();

  const legacyValue = legacyDocs.find((doc) => doc._id === SEQUENCE_ID)?.value ?? 0;
  const targetValue = targetDocs.find((doc) => doc._id === SEQUENCE_ID)?.value ?? 0;
  const mergedValue = Math.max(floor, maxInDb, legacyValue, targetValue);

  console.log('\nCálculo do contador:');
  console.log(`  floor=${floor}`);
  console.log(`  max chamados_n1=${maxInDb}`);
  console.log(`  legado desk_config=${legacyValue || 'n/a'}`);
  console.log(`  atual b2c_chamados=${targetValue || 'n/a'}`);
  console.log(`  valor final=${mergedValue} → exibição ${formatProtocolo(mergedValue)}`);

  if (dryRun) {
    console.log('\n[dry-run] Nenhuma alteração aplicada.');
    await disconnectDatabase();
    return;
  }

  await chamadosColl.updateOne(
    { _id: SEQUENCE_ID },
    { $set: { value: mergedValue } },
    { upsert: true },
  );
  console.log(`\n✓ Contador gravado em ${env.mongoDbName}.${LEGACY_COLLECTION}`);

  const legacyExists = await deskConfigColl
    .findOne({}, { projection: { _id: 1 } })
    .then(Boolean)
    .catch(() => false);

  if (legacyExists) {
    await deskConfigColl.drop();
    console.log(`✓ Collection ${env.mongoDeskConfigDbName}.${LEGACY_COLLECTION} removida`);
  } else {
    console.log(`• ${env.mongoDeskConfigDbName}.${LEGACY_COLLECTION} já estava ausente`);
  }

  console.log('\nMigração concluída.');
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha na migração:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
