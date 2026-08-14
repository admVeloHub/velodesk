/**
 * octadesk-dump-interactions.ts v1.0.0
 * Passada B — bulk GET /tickets/interactions por mês → merge em importados_octadesk
 *
 * Uso:
 *   npx tsx scripts/octadesk-dump-interactions.ts
 *   npx tsx scripts/octadesk-dump-interactions.ts --from=2024-11 --to=2025-01
 *   npx tsx scripts/octadesk-dump-interactions.ts --reset-checkpoint
 */
import {
  connectLegadoTickets,
  disconnectLegadoTickets,
  getCheckpoint,
  setCheckpoint,
  importadosCol,
  octadeskFetch,
  parseArg,
  hasFlag,
  requireOctadeskApiKey,
} from './lib/octadeskDumpShared';
import { toProtocoloDesk } from '../src/utils/octadeskProtocolo';

const PASS = 'passB-interactions';
const TAKE = 50;

/** Lista YYYY-MM desde start até end (inclusive). */
function monthRange(fromYm: string, toYm: string): string[] {
  const out: string[] = [];
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // último dia do mês
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

interface BulkItem {
  number?: string | number;
  interactions?: unknown[];
}

async function mergeInteractionsForTicket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  col: any,
  octadeskNumber: number,
  interactions: unknown[],
): Promise<void> {
  const protocolo = toProtocoloDesk(octadeskNumber);
  const now = new Date();

  // Merge por _id de interação (idempotente)
  const existing = await col.findOne(
    { octadeskNumber },
    { projection: { interactions: 1 } },
  );

  const byId = new Map<string, unknown>();
  const pushAll = (list: unknown[]) => {
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const id = String((item as { _id?: string; id?: string })._id
        || (item as { id?: string }).id
        || JSON.stringify(item).slice(0, 80));
      byId.set(id, item);
    }
  };
  pushAll(Array.isArray(existing?.interactions) ? existing.interactions : []);
  pushAll(interactions);

  await col.updateOne(
    { octadeskNumber },
    {
      $set: {
        protocolo,
        octadeskNumber,
        interactions: [...byId.values()],
        updatedAt: now,
        'importMeta.source': 'octadesk-dump',
        'importMeta.passB': { status: 'done', at: now },
      },
      $setOnInsert: {
        createdAt: now,
        ticket: {},
        attachments: [],
        'importMeta.importedAt': now,
      },
    },
    { upsert: true },
  );
}

async function main(): Promise<void> {
  requireOctadeskApiKey();

  const fromYm = parseArg('from') || '2024-11';
  const toYm = parseArg('to') || (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  })();

  const months = monthRange(fromYm, toYm);
  const db = await connectLegadoTickets();
  const col = importadosCol(db);

  if (hasFlag('reset-checkpoint')) {
    await setCheckpoint(db, PASS, { monthIndex: 0, page: 1, done: false });
    console.log('[passB] checkpoint resetado');
  }

  const cp = (await getCheckpoint(db, PASS)) || {};
  let monthIndex = Number(cp.monthIndex || 0);
  let page = Number(cp.page || 1);
  if (monthIndex < 0) monthIndex = 0;
  if (page < 1) page = 1;

  console.log(`[passB] meses=${months.length} from=${fromYm} to=${toYm} start monthIndex=${monthIndex} page=${page}`);

  let ticketsTouched = 0;
  let interactionRows = 0;

  while (monthIndex < months.length) {
    const ym = months[monthIndex];
    const { from, to } = monthBounds(ym);
    console.log(`[passB] mês ${ym} from=${from} to=${to} page=${page}`);

    while (true) {
      const path = `/tickets/interactions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&take=${TAKE}`;
      const res = await octadeskFetch(path);
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`[passB] HTTP ${res.status}: ${res.text.slice(0, 400)}`);
      }

      const list = Array.isArray(res.body) ? (res.body as BulkItem[]) : [];
      if (!list.length) {
        console.log(`[passB] ${ym} page=${page} vazia — próximo mês`);
        break;
      }

      for (const item of list) {
        const n = Number(item.number);
        if (!Number.isFinite(n) || n <= 0) continue;
        const ints = Array.isArray(item.interactions) ? item.interactions : [];
        await mergeInteractionsForTicket(col, n, ints);
        ticketsTouched += 1;
        interactionRows += ints.length;
      }

      console.log(
        `[passB] ${ym} page=${page} batch=${list.length} ticketsTouched=${ticketsTouched} ints=${interactionRows}`,
      );

      await setCheckpoint(db, PASS, {
        monthIndex,
        month: ym,
        page: page + 1,
        done: false,
        ticketsTouched,
        interactionRows,
      });

      page += 1;
      if (list.length < TAKE) {
        console.log(`[passB] ${ym} última página (batch < take)`);
        break;
      }
    }

    monthIndex += 1;
    page = 1;
    await setCheckpoint(db, PASS, {
      monthIndex,
      page: 1,
      done: monthIndex >= months.length,
      ticketsTouched,
      interactionRows,
      finishedAt: monthIndex >= months.length ? new Date() : undefined,
    });
  }

  console.log(JSON.stringify({
    pass: PASS,
    months,
    ticketsTouched,
    interactionRows,
  }, null, 2));
}

main()
  .catch(async (err) => {
    console.error('[passB] falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectLegadoTickets().catch(() => undefined);
  });
