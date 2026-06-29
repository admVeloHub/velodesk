/**
 * Remove chamados demo do MongoDB (dev)
 * Uso: npx tsx scripts/clear-demo-chamados.ts
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { env } from '../src/config/env';

async function main() {
  await connectDatabase();
  const result = await ChamadoN1.deleteMany({});
  console.log(`Removidos ${result.deletedCount} documento(s) de ${env.mongoDbName}.chamados_n1`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
