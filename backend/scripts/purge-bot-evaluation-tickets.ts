/**
 * purge-bot-evaluation-tickets v1.0.0
 * Remove tickets gerados por pesquisas de avaliação (info@velotax.info) e bounces relacionados.
 *
 * Uso:
 *   npm run purge:bot-evaluation          # dry-run (padrão)
 *   npm run purge:bot-evaluation -- --execute
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { ChamadoN1 } from '../src/models/ChamadoN1';
import {
  buildBotEvaluationTicketFilter,
  countBotEvaluationTickets,
  purgeBotEvaluationTickets,
} from '../src/services/botEvaluationPurge.service';

async function sampleTickets(limit = 8) {
  const filter = buildBotEvaluationTicketFilter();
  return ChamadoN1.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('chamadoProtocolo chamadoTitulo createdAt registro.metadados.emailFrom registro.metadados.emailSubject')
    .lean();
}

async function main() {
  const execute = process.argv.includes('--execute');

  await connectDatabase();
  const total = await countBotEvaluationTickets();
  const samples = await sampleTickets();

  console.log('[purge-bot-evaluation] remetentes alvo: info@velotax.info, mailer-daemon@googlemail.com (bounce)');
  console.log(`[purge-bot-evaluation] tickets encontrados: ${total}`);
  console.log('');

  if (samples.length) {
    console.log('Amostra (mais recentes):');
    samples.forEach((doc) => {
      const meta = doc.registro?.[0]?.metadados as { emailFrom?: string; emailSubject?: string } | undefined;
      console.log(
        `  - ${doc.chamadoProtocolo || '(sem protocolo)'} | ${doc.chamadoTitulo}`
        + ` | from=${meta?.emailFrom || '-'} | ${doc.createdAt?.toISOString?.() || ''}`,
      );
    });
    console.log('');
  }

  if (!execute) {
    console.log('[purge-bot-evaluation] DRY-RUN — nada removido. Use --execute para expurgar.');
    await disconnectDatabase();
    return;
  }

  const removed = await purgeBotEvaluationTickets();
  console.log(`[purge-bot-evaluation] removidos: ${removed}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('[purge-bot-evaluation] falhou:', err);
  await disconnectDatabase();
  process.exit(1);
});
