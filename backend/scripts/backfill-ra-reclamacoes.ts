/** backfill-ra-reclamacoes v1.0.0 — espelha tickets RA de chamados_n1 em reclamacoes_reclameAqui */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import { reclameAquiChannelMongoFilter } from '../src/services/chamado.mapper';
import { buildFastPathTriagem } from '../src/services/agents/casosEspeciaisAgent.service';
import {
  findByChamadoId,
  upsertFromChamado,
} from '../src/services/reclamacoes/reclamacao.service';

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  await connectDatabase();

  const filter = {
    $or: [
      reclameAquiChannelMongoFilter(),
      { 'tabulacao.canal': { $regex: /reclame.?aqui/i } },
    ],
  };

  const tickets = await ChamadoN1.find(filter).exec();
  let already = 0;
  let upserted = 0;
  let failed = 0;
  const errors: Array<{ protocolo: string; message: string }> = [];

  for (const chamado of tickets) {
    const chamadoId = chamado._id!.toString();
    const existing = await findByChamadoId('reclame_aqui', chamadoId);
    if (existing) {
      already += 1;
      continue;
    }
    if (!execute) {
      upserted += 1;
      continue;
    }
    try {
      const triagem = {
        ...buildFastPathTriagem('reclame_aqui', ['backfill-ra-reclamacoes']),
        signals: ['backfill-ra-reclamacoes'],
        at: new Date().toISOString(),
      };
      const doc = await upsertFromChamado(chamado, triagem, { origemEntrada: 'backfill-ra' });
      if (!doc) {
        throw new Error('upsertFromChamado retornou null');
      }
      upserted += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        protocolo: String(chamado.chamadoProtocolo || chamadoId),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'dry-run',
    scanned: tickets.length,
    alreadyMirrored: already,
    upserted: execute ? upserted : 0,
    wouldUpsert: execute ? undefined : upserted,
    failed,
    errors: errors.slice(0, 50),
  }, null, 2));

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha no backfill RA:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
