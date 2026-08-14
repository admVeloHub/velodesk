/**
 * octadesk-dump-reset.ts v1.0.0
 * Esvazia o staging do dump Octadesk (legado_tickets) e zera os checkpoints.
 *
 * Uso:
 *   npx tsx scripts/octadesk-dump-reset.ts            (dry-run: só mostra contagens)
 *   npx tsx scripts/octadesk-dump-reset.ts --execute  (apaga de fato)
 */
import {
  connectLegadoTickets,
  disconnectLegadoTickets,
  importadosCol,
  checkpointsCol,
  IMPORTADOS_COLLECTION,
  CHECKPOINTS_COLLECTION,
  hasFlag,
} from './lib/octadeskDumpShared';

async function clearCollection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  col: any,
  label: string,
): Promise<{ method: 'deleteMany' | 'drop'; deletedCount: number | null }> {
  const before = await col.countDocuments();
  try {
    const res = await col.deleteMany({});
    return { method: 'deleteMany', deletedCount: res.deletedCount };
  } catch (err) {
    console.warn(`[dump-reset] deleteMany bloqueado em ${label} (${(err as Error).message.slice(0, 80)}...) — usando drop`);
    await col.drop();
    return { method: 'drop', deletedCount: before };
  }
}

async function main(): Promise<void> {
  const execute = hasFlag('execute');
  // Cluster acima da quota bloqueia createIndex; o reset não depende de índices.
  const db = await connectLegadoTickets({ ensureIndexes: false });
  const col = importadosCol(db);
  const cps = checkpointsCol(db);

  const before = {
    [IMPORTADOS_COLLECTION]: await col.countDocuments(),
    [CHECKPOINTS_COLLECTION]: await cps.countDocuments(),
  };

  if (!execute) {
    console.log(JSON.stringify({ mode: 'dry-run', before, hint: 'use --execute para apagar' }, null, 2));
    return;
  }

  // Acima da quota o Atlas barra deleteMany; drop libera o espaço e é aceito.
  const deletedDocs = await clearCollection(col, IMPORTADOS_COLLECTION);
  const deletedCps = await clearCollection(cps, CHECKPOINTS_COLLECTION);

  const after = {
    [IMPORTADOS_COLLECTION]: await col.countDocuments(),
    [CHECKPOINTS_COLLECTION]: await cps.countDocuments(),
  };

  console.log(JSON.stringify({
    mode: 'execute',
    before,
    removed: {
      [IMPORTADOS_COLLECTION]: deletedDocs,
      [CHECKPOINTS_COLLECTION]: deletedCps,
    },
    after,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('[dump-reset] falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectLegadoTickets().catch(() => undefined);
  });
