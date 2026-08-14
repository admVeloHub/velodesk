/**
 * octadesk-dump-report.ts v1.0.0
 * Relatório: totais API vs staging, protocolos, anexos failed, amostragem
 *
 * Uso:
 *   npx tsx scripts/octadesk-dump-report.ts
 */
import {
  connectLegadoTickets,
  disconnectLegadoTickets,
  importadosCol,
  getCheckpoint,
  octadeskFetch,
  headerInt,
  requireOctadeskApiKey,
} from './lib/octadeskDumpShared';
import { toProtocoloDesk } from '../src/utils/octadeskProtocolo';

async function main(): Promise<void> {
  requireOctadeskApiKey();
  const db = await connectLegadoTickets();
  const col = importadosCol(db);

  const res = await octadeskFetch('/tickets?page=1&limit=1');
  const apiTotal = headerInt(res.headers, 'X-Total-Items');

  const stagingCount = await col.countDocuments();
  const withInteractions = await col.countDocuments({
    'interactions.0': { $exists: true },
  });
  const withoutInteractions = stagingCount - withInteractions;
  const withAttachments = await col.countDocuments({
    'attachments.0': { $exists: true },
  });
  const attachmentsFailed = await col.countDocuments({
    'attachments.status': 'failed',
  });
  const attachmentsOk = await col.countDocuments({
    'attachments.status': 'ok',
  });
  const passADone = await col.countDocuments({ 'importMeta.passA.status': 'done' });
  const passBDone = await col.countDocuments({ 'importMeta.passB.status': 'done' });
  const passCDone = await col.countDocuments({ 'importMeta.passC.status': 'done' });

  const cpA = await getCheckpoint(db, 'passA-tickets');
  const cpB = await getCheckpoint(db, 'passB-interactions');

  // Amostragem de protocolo: 6 dígitos e 9 dígitos se existirem
  const sampleSmall = await col.find({
    octadeskNumber: { $lt: 1_000_000 },
  }).limit(5).project({ octadeskNumber: 1, protocolo: 1 }).toArray();

  const sampleNine = await col.find({
    octadeskNumber: { $gte: 100_000_000, $lt: 1_000_000_000 },
  }).limit(5).project({ octadeskNumber: 1, protocolo: 1 }).toArray();

  const protocolCheck = [...sampleSmall, ...sampleNine].map((d) => {
    const n = Number(d.octadeskNumber);
    const expected = toProtocoloDesk(n);
    return {
      octadeskNumber: n,
      protocolo: d.protocolo,
      expected,
      ok: d.protocolo === expected && String(d.protocolo).length === 10,
    };
  });

  const failedSample = await col.find({ 'attachments.status': 'failed' })
    .limit(10)
    .project({ octadeskNumber: 1, protocolo: 1, attachments: 1 })
    .toArray();

  const report = {
    apiTotalTickets: apiTotal,
    stagingCount,
    deltaApiVsStaging: apiTotal != null ? apiTotal - stagingCount : null,
    withInteractions,
    withoutInteractions,
    withAttachments,
    attachmentsOkDocs: attachmentsOk,
    attachmentsFailedDocs: attachmentsFailed,
    passADone,
    passBDone,
    passCDone,
    checkpointPassA: cpA,
    checkpointPassB: cpB,
    protocolSamples: protocolCheck,
    failedAttachmentSamples: failedSample.map((d) => ({
      octadeskNumber: d.octadeskNumber,
      protocolo: d.protocolo,
      failed: (d.attachments || [])
        .filter((a: { status?: string }) => a.status === 'failed')
        .map((a: { name?: string; error?: string; originUrl?: string }) => ({
          name: a.name,
          error: a.error,
          originUrl: a.originUrl?.slice(0, 80),
        })),
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(async (err) => {
    console.error('[report] falhou:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectLegadoTickets().catch(() => undefined);
  });
