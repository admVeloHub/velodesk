/** test-gmail-inbound.ts v1.0.1 — teste E2E Gmail inbound (history + pubsub simulado) */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDeskConfigConnected } from '../src/config/database';
import { env } from '../src/config/env';
import { loadEmailTransport, isEmailTransportReady, getDelegatedUserEmail } from '../src/services/emailTransport.service';
import { createGmailClient, GMAIL_SCOPE_READONLY } from '../src/services/gmail/gmailAuth';
import {
  getGmailWatchHealth,
  getStoredHistoryId,
  setupGmailWatch,
} from '../src/services/gmail/gmailWatch.service';
import {
  decodePubSubMessage,
  handleGmailPubSubPush,
  processGmailHistory,
} from '../src/services/gmail/gmailInbound.service';
import {
  gmailMessageToInboundPayload,
  shouldSkipGmailMessage,
} from '../src/services/gmail/gmailMessageParser';

function usage() {
  console.log(`
Uso: npm run test:gmail-inbound -- [opções]

  --list              Lista últimas mensagens INBOX (não processa)
  --history           Processa history Gmail desde o historyId salvo (fluxo Pub/Sub)
  --replay-from <id>  Processa history desde um historyId específico (teste/debug)
  --simulate-pubsub   Simula POST Pub/Sub com historyId atual
  --watch             Garante users.watch ativo antes do teste
  --help              Esta ajuda

Exemplo E2E:
  1) Envie e-mail para suporte@velotax.com.br com assunto "[TEST INBOUND] ..."
  2) npm run test:gmail-inbound -- --watch --history
`);
}

async function ensureReady(): Promise<void> {
  if (!env.emailEnabled) {
    throw new Error('EMAIL_ENABLED=true no .env');
  }

  await connectDatabase();

  if (!isDeskConfigConnected()) {
    throw new Error('desk_config não conectou');
  }

  await loadEmailTransport();

  if (!isEmailTransportReady()) {
    throw new Error('email_transport incompleto — rode: npm run seed:email-transport');
  }
}

async function listRecentInbox(limit = 8) {
  const gmail = await createGmailClient([GMAIL_SCOPE_READONLY]);
  const delegated = getDelegatedUserEmail();

  const list = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: limit,
  });

  const ids = list.data.messages ?? [];
  if (ids.length === 0) {
    console.log('INBOX vazio — envie um e-mail de teste para', delegated);
    return;
  }

  console.log(`\nÚltimas ${ids.length} mensagens INBOX (${delegated}):\n`);

  for (const ref of ids) {
    if (!ref.id) continue;
    const full = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date', 'Message-Id'] });
    const headers = full.data.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
    const skip = shouldSkipGmailMessage(full.data, delegated);
    console.log(`- id=${ref.id} skip=${skip}`);
    console.log(`  From: ${get('From')}`);
    console.log(`  Subject: ${get('Subject')}`);
    console.log(`  Date: ${get('Date')}`);
    console.log(`  Message-Id: ${get('Message-Id')}`);
    console.log('');
  }
}

async function runHistoryTest(startOverride?: string) {
  const stored = await getStoredHistoryId();
  if (!stored && !startOverride) {
    console.warn('historyId não salvo — configurando watch...');
    const watch = await setupGmailWatch();
    if (!watch) throw new Error('setupGmailWatch falhou');
    console.log('watch OK historyId=', watch.historyId);
  }

  const startId = startOverride ?? (await getStoredHistoryId()) ?? '';
  console.log(`Processando history desde historyId=${startId} ...`);

  const results = await processGmailHistory(startId);
  if (results.length === 0) {
    console.log('Nenhuma mensagem nova processada.');
    console.log('Envie e-mail para suporte@velotax.com.br e rode novamente com --history');
    return;
  }

  console.log(`OK — ${results.length} mensagem(ns) processada(s):`);
  for (const r of results) {
    console.log(`  action=${r.action} protocolo=${r.chamadoProtocolo} ticketId=${r.ticketId}`);
  }
}

async function runSimulatePubSub() {
  const stored = await getStoredHistoryId();
  if (!stored) {
    const watch = await setupGmailWatch();
    if (!watch) throw new Error('setupGmailWatch falhou');
  }

  const historyId = (await getStoredHistoryId()) ?? '0';
  const payload = { emailAddress: getDelegatedUserEmail(), historyId };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const body = { message: { data, messageId: `test-${Date.now()}`, publishTime: new Date().toISOString() } };

  const decoded = decodePubSubMessage(body);
  console.log('Pub/Sub decodificado:', decoded);

  const { processed, results } = await handleGmailPubSubPush(body);
  console.log(`Simulação Pub/Sub — processed=${processed}`);
  for (const r of results) {
    console.log(`  action=${r.action} protocolo=${r.chamadoProtocolo} ticketId=${r.ticketId}`);
  }
  if (processed === 0) {
    console.log('Nenhuma mensagem nova — envie e-mail de teste e repita.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  const doList = args.includes('--list');
  const doHistory = args.includes('--history');
  const doSimulate = args.includes('--simulate-pubsub');
  const doWatch = args.includes('--watch');
  const replayIdx = args.indexOf('--replay-from');
  const replayFrom = replayIdx >= 0 ? String(args[replayIdx + 1] ?? '').trim() : '';

  if (!doList && !doHistory && !doSimulate && !doWatch && !replayFrom) {
    usage();
    console.log('\nNenhuma opção — executando --list --watch --history\n');
  }

  await ensureReady();

  const health = await getGmailWatchHealth();
  console.log('Health local:', JSON.stringify(health, null, 2));

  if (doWatch || doHistory || doSimulate || (!doList && !doHistory && !doSimulate)) {
    if (!health.ready) {
      console.log('Ativando Gmail watch...');
      const watch = await setupGmailWatch();
      if (!watch) throw new Error('setupGmailWatch falhou — verifique gmail.readonly');
      console.log('watch OK', watch);
    }
  }

  if (doList || (!doHistory && !doSimulate)) {
    await listRecentInbox();
  }

  if (doHistory || replayFrom || (!doList && !doSimulate)) {
    await runHistoryTest(replayFrom || undefined);
  }

  if (doSimulate) {
    await runSimulatePubSub();
  }

  await disconnectDatabase();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FALHA:', (err as Error).message);
  try {
    await disconnectDatabase();
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
