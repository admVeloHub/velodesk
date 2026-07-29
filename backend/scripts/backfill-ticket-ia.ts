/**
 * Backfill controlado da visão do cliente.
 * Padrão: dry-run, máximo 10 tickets. Use --execute apenas após revisar a amostra.
 */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { runChamadoIaBackfill } from '../src/services/chamadoIaAnalise.service';

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  const maxArg = process.argv.find((arg) => arg.startsWith('--max='));
  const max = Math.min(100, Math.max(1, Number(maxArg?.split('=')[1] ?? 10)));
  await connectDatabase();
  const result = await runChamadoIaBackfill({ max, dryRun: !execute });
  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'dry-run',
    ceilingTickets: max,
    ...result,
  }, null, 2));
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error('Falha no backfill:', err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
