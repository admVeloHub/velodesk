/**
 * Cria tickets fictícios para testar workflow visual no Desk (dev)
 * Uso: npm run seed:workflow-test
 * Limpar: npm run seed:workflow-test -- --purge
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import {
  purgeWorkflowTestTickets,
  seedWorkflowTestTickets,
  WORKFLOW_TEST_PROTOCOL_PREFIX,
} from '../src/services/workflowTestSeed.service';

async function connectWithDevFallback(): Promise<void> {
  try {
    await connectDatabase();
    return;
  } catch (err) {
    if (env.nodeEnv === 'production') throw err;
    console.warn('[seed] MongoDB local indisponível — usando memória embarcada (dev).');
    const memory = await MongoMemoryServer.create();
    await connectDatabase(memory.getUri('velodesk'));
  }
}

async function main() {
  const purge = process.argv.includes('--purge');

  await connectWithDevFallback();

  if (purge) {
    const removed = await purgeWorkflowTestTickets();
    console.log(`Removidos ${removed} ticket(s) de teste (${WORKFLOW_TEST_PROTOCOL_PREFIX}*)`);
    await disconnectDatabase();
    return;
  }

  const { created, skipped } = await seedWorkflowTestTickets();
  console.log(`Seed workflow test: ${created} ticket(s) criado(s), ${skipped} já existente(s)`);
  console.log('');
  console.log('Tickets disponíveis em http://localhost:8000/tickets?desk=v2');
  console.log('Console de aprovação: http://localhost:8000/workflow (perfil Workflow)');
  console.log('');
  console.log('Cenários:');
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}001 — Helena Mendes — classificar Solicitação + Produto X + Reembolso`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}002 — Ricardo Almeida — Solicitação + Encaminhar para Financeiro`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}003 — Camila Souza — workflow JÁ ATIVO (ver UI completa)`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}004 — Gustavo Lima — ticket normal (sem workflow)`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}005 — Patricia Nunes — Solicitação + Encaminhar para N2`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}006 — Bruno Carvalho — dúvida simples (sem workflow)`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}007 — Maria Oliveira — fila de aprovação (/workflow)`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}008 — Roberto Alves — fila de aprovação (/workflow)`);
  console.log(`  ${WORKFLOW_TEST_PROTOCOL_PREFIX}009 — Fernanda Lima — SLA crítico (/workflow)`);

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
