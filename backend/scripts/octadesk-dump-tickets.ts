/**
 * octadesk-dump-tickets.ts v1.0.0
 * Passada A — lista todos os tickets Octadesk → legado_tickets.importados_octadesk
 *
 * Uso:
 *   npx tsx scripts/octadesk-dump-tickets.ts
 *   npx tsx scripts/octadesk-dump-tickets.ts --max-pages=5
 *   npx tsx scripts/octadesk-dump-tickets.ts --reset-checkpoint
 */
import {
  connectLegadoTickets,
  disconnectLegadoTickets,
  getCheckpoint,
  setCheckpoint,
  importadosCol,
  octadeskFetch,
  headerInt,
  buildUpsertFromTicket,
  parseArg,
  hasFlag,
  requireOctadeskApiKey,
} from './lib/octadeskDumpShared';

const PASS = 'passA-tickets';
const LIMIT = 100;

async function main(): Promise<void> {
  requireOctadeskApiKey();
  const maxPages = Number(parseArg('max-pages') || '0') || 0;
  const db = await connectLegadoTickets();
  const col = importadosCol(db);

  if (hasFlag('reset-checkpoint')) {
    await setCheckpoint(db, PASS, { page: 1, done: false });
    console.log('[passA] checkpoint resetado para page=1');
  }

  const cp = (await getCheckpoint(db, PASS)) || {};
  let page = Number(cp.page || 1);
  if (!Number.isFinite(page) || page < 1) page = 1;

  let pagesDone = 0;
  let upserted = 0;
  let totalItems: number | null = null;
  let totalPages: number | null = null;

  console.log(`[passA] iniciando em page=${page} limit=${LIMIT}`);

  while (true) {
    if (maxPages > 0 && pagesDone >= maxPages) {
      console.log(`[passA] --max-pages=${maxPages} atingido`);
      break;
    }

    const path = `/tickets?page=${page}&limit=${LIMIT}&sort[property]=number&sort[direction]=asc`;
    const res = await octadeskFetch(path);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`[passA] HTTP ${res.status}: ${res.text.slice(0, 400)}`);
    }

    totalItems = headerInt(res.headers, 'X-Total-Items') ?? totalItems;
    totalPages = headerInt(res.headers, 'X-Total-Pages') ?? totalPages;
    const nextPage = String(res.headers.get('X-Next-Page') || '').toLowerCase() === 'true';

    const list = Array.isArray(res.body) ? (res.body as Record<string, unknown>[]) : [];
    if (!list.length) {
      console.log(`[passA] página ${page} vazia — fim`);
      await setCheckpoint(db, PASS, {
        page,
        done: true,
        totalItems,
        totalPages,
        finishedAt: new Date(),
      });
      break;
    }

    const ops = list.map((ticket) => {
      const { filter, update } = buildUpsertFromTicket(ticket);
      return { updateOne: { filter, update, upsert: true } };
    });

    const bulk = await col.bulkWrite(ops as never, { ordered: false });
    const pageUpserts = (bulk.upsertedCount || 0) + (bulk.modifiedCount || 0) + (bulk.matchedCount || 0);
    upserted += list.length;

    console.log(
      `[passA] page=${page}/${totalPages ?? '?'} items=${list.length} `
      + `bulk(upserted=${bulk.upsertedCount} mod=${bulk.modifiedCount}) `
      + `totalAPI=${totalItems ?? '?'} acumulado=${upserted}`,
    );

    await setCheckpoint(db, PASS, {
      page: page + 1,
      done: false,
      totalItems,
      totalPages,
      lastNumbers: list.slice(0, 3).map((t) => t.number),
    });

    pagesDone += 1;
    page += 1;

    if (!nextPage && (totalPages == null || page > totalPages)) {
      await setCheckpoint(db, PASS, {
        page,
        done: true,
        totalItems,
        totalPages,
        finishedAt: new Date(),
      });
      console.log('[passA] sem próxima página — concluído');
      break;
    }
  }

  const count = await col.countDocuments();
  console.log(JSON.stringify({
    pass: PASS,
    upsertedBatch: upserted,
    stagingCount: count,
    totalItemsApi: totalItems,
    pagesProcessed: pagesDone,
  }, null, 2));
}

main()
  .catch(async (err) => {
    console.error('[passA] falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectLegadoTickets().catch(() => undefined);
  });
