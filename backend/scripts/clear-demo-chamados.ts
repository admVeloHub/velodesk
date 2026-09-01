/**
 * clear-demo-chamados v1.0.0 — esvazia chamados_n1 (b2c_chamados)
 * VERSION: v1.0.0 | DATE: 2026-08-20
 *
 * Uso:
 *   npm run clear:demo-chamados              # dry-run (conta documentos)
 *   npm run clear:demo-chamados -- --execute # remove todos os chamados
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { ChamadoN1 } from '../src/models/ChamadoN1';

async function main() {
  const execute = process.argv.includes('--execute');

  await connectDatabase();

  const total = await ChamadoN1.estimatedDocumentCount();
  const exact = await ChamadoN1.countDocuments();

  console.log('[clear-demo-chamados] banco:', env.mongoDbName);
  console.log('[clear-demo-chamados] collection: chamados_n1');
  console.log(`[clear-demo-chamados] documentos: ~${total} (countDocuments=${exact})`);

  if (!exact) {
    console.log('[clear-demo-chamados] collection já está vazia.');
    await disconnectDatabase();
    return;
  }

  if (!execute) {
    console.log('[clear-demo-chamados] DRY-RUN — nada removido. Use --execute para esvaziar.');
    await disconnectDatabase();
    return;
  }

  const result = await ChamadoN1.deleteMany({});
  const remaining = await ChamadoN1.countDocuments();

  console.log(`[clear-demo-chamados] removidos: ${result.deletedCount ?? 0}`);
  console.log(`[clear-demo-chamados] restantes: ${remaining}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[clear-demo-chamados] falhou:', err);
  await disconnectDatabase();
  process.exit(1);
});
