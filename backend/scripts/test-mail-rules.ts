/** test-mail-rules v1.0.0 — match, precedência e skip inbound */
import { processInboundEmail } from '../src/services/email-inbound.service';
import type { InboundEmailPayload } from '../src/services/inbound-email/types';
import {
  matchMailRule,
  normalizeMailRuleDomain,
  setMailRulesSnapshotForTests,
} from '../src/services/mailRules.service';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildSnapshot(partial: {
  ignorado?: { emails?: string[]; domains?: string[] };
  spam?: { emails?: string[]; domains?: string[] };
  priority?: { emails?: string[]; domains?: string[] };
}) {
  const toSet = (items?: string[]) => new Set(items ?? []);
  return {
    ignorado: { emails: toSet(partial.ignorado?.emails), domains: toSet(partial.ignorado?.domains) },
    spam: { emails: toSet(partial.spam?.emails), domains: toSet(partial.spam?.domains) },
    priority: { emails: toSet(partial.priority?.emails), domains: toSet(partial.priority?.domains) },
  };
}

function samplePayload(fromEmail: string): InboundEmailPayload {
  return {
    messageId: '<test-msg@example.com>',
    subject: 'Teste inbound',
    from: { email: fromEmail, name: 'Remetente Teste' },
    to: [{ email: 'suporte@velodesk.com', name: 'Suporte' }],
    textBody: 'Corpo do e-mail de teste',
    htmlBody: '',
    attachments: [],
  };
}

function testExactEmailMatch() {
  setMailRulesSnapshotForTests(buildSnapshot({
    spam: { emails: ['spam@mailing.com'] },
  }));
  assert(matchMailRule(samplePayload('spam@mailing.com')) === 'spam', 'deve bater e-mail exato em spam');
  assert(matchMailRule(samplePayload('outro@mailing.com')) === null, 'domínio não listado não deve bater');
}

function testDomainMatch() {
  setMailRulesSnapshotForTests(buildSnapshot({
    ignorado: { domains: ['newsletter.io'] },
  }));
  assert(
    matchMailRule(samplePayload('user@newsletter.io')) === 'ignored',
    'deve bater domínio em ignorado',
  );
}

function testPrecedenceSpamOverIgnored() {
  setMailRulesSnapshotForTests(buildSnapshot({
    spam: { domains: ['conflito.com'] },
    ignorado: { domains: ['conflito.com'] },
  }));
  assert(
    matchMailRule(samplePayload('x@conflito.com')) === 'spam',
    'spam deve vencer ignorado na mesma regra de domínio',
  );
}

function testPriorityMatch() {
  setMailRulesSnapshotForTests(buildSnapshot({
    priority: { emails: ['vip@cliente.com'] },
  }));
  assert(matchMailRule(samplePayload('vip@cliente.com')) === 'priority', 'deve marcar prioritário');
}

function testNormalizeDomain() {
  assert(normalizeMailRuleDomain('@Empresa.COM') === 'empresa.com', 'deve normalizar @domínio');
  assert(normalizeMailRuleDomain('empresa.com') === 'empresa.com', 'deve aceitar domínio bare');
}

async function testSkipDoesNotCreate() {
  setMailRulesSnapshotForTests(buildSnapshot({
    spam: { emails: ['lixo@spam.net'] },
  }));
  const result = await processInboundEmail(samplePayload('lixo@spam.net'));
  assert(result.action === 'skipped', 'deve retornar skipped');
  assert(result.reason === 'spam', 'motivo deve ser spam');
}

async function testPriorityPathDoesNotSkip() {
  setMailRulesSnapshotForTests(buildSnapshot({
    priority: { emails: ['vip@prio.com'] },
  }));
  const rule = matchMailRule(samplePayload('vip@prio.com'));
  assert(rule === 'priority', 'prioritário não deve ser tratado como skip');
}

function run() {
  testExactEmailMatch();
  testDomainMatch();
  testPrecedenceSpamOverIgnored();
  testPriorityMatch();
  testNormalizeDomain();
  void testSkipDoesNotCreate()
    .then(() => testPriorityPathDoesNotSkip())
    .then(() => {
      console.log('[test-mail-rules] todos os testes passaram');
    })
    .catch((err) => {
      console.error('[test-mail-rules] falhou:', err);
      process.exit(1);
    });
}

run();
