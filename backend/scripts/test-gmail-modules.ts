/** test-gmail-modules.ts v1.2.0 — smoke test Gmail + anexos inline/CID */
import { buildProtocolSubject } from '../src/services/email-outbound.service';
import { buildRawRfc822 } from '../src/services/gmail/gmailApiSend';
import { decodePubSubMessage } from '../src/services/gmail/gmailInbound.service';
import { gmailMessageToInboundPayload, shouldSkipGmailMessage } from '../src/services/gmail/gmailMessageParser';
import { listGmailAttachmentParts } from '../src/services/gmail/gmailAttachment.service';
import {
  attachmentHashFingerprint,
  attachmentMatchesKnownFingerprints,
  attachmentNameFingerprint,
  attachmentSizeNameFingerprint,
} from '../src/services/attachmentFilter.util';
import { composeHtmlToEmailHtml } from '../src/services/emailHtml.util';
import { buildThreadSubject } from '../src/services/emailThread.service';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testBuildProtocolSubject() {
  const s = buildProtocolSubject('0100177678', 'Duvida');
  assert(s === '[0100177678] Atendimento Velotax Numero 0100177678', `subject: ${s}`);
}

function testBuildRawRfc822() {
  const raw = buildRawRfc822({
    from: 'chamados@test.com',
    to: 'cliente@test.com',
    subject: 'Teste',
    html: '<p>oi</p>',
    messageId: '<desk.test@velotax.com.br>',
    inReplyTo: '<desk.root@velotax.com.br>',
    references: ['<desk.root@velotax.com.br>'],
  });
  assert(raw.length > 10, 'raw vazio');
  const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  assert(decoded.includes('Message-ID:'), 'Message-ID ausente');
  assert(decoded.includes('In-Reply-To:'), 'In-Reply-To ausente');
  assert(decoded.includes('References:'), 'References ausente');
}

function testComposeHtmlToEmailHtml() {
  const html = composeHtmlToEmailHtml('Olá <strong>negrito</strong> e <em>itálico</em>');
  assert(html.includes('<strong>negrito</strong>'), 'negrito perdido');
  assert(html.includes('<em>itálico</em>'), 'itálico perdido');
}

function testBuildThreadSubject() {
  const first = buildThreadSubject('0100177678', 'Dúvida', false);
  const reply = buildThreadSubject('0100177678', 'Dúvida', true);
  assert(first === '[0100177678] Atendimento Velotax Numero 0100177678', `first: ${first}`);
  assert(reply === 'Re: [0100177678] Atendimento Velotax Numero 0100177678', `reply: ${reply}`);
}

function testDecodePubSub() {
  const payload = { emailAddress: 'a@b.com', historyId: '12345' };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const decoded = decodePubSubMessage({ message: { data } });
  assert(decoded?.historyId === '12345', 'decode falhou');
}

function testGmailMessageParser() {
  const skip = shouldSkipGmailMessage(
    { labelIds: ['SENT'], payload: { headers: [] } },
    'chamados@test.com'
  );
  assert(skip === true, 'deveria pular SENT');

  const payload = gmailMessageToInboundPayload({
    id: 'msg1',
    internalDate: String(Date.now()),
    payload: {
      headers: [
        { name: 'From', value: 'Cliente <cliente@test.com>' },
        { name: 'To', value: 'chamados@test.com' },
        { name: 'Subject', value: 'Ajuda' },
        { name: 'Message-Id', value: '<abc@test.com>' },
      ],
      mimeType: 'text/plain',
      body: { data: Buffer.from('Preciso de ajuda').toString('base64') },
    },
  });
  assert(payload?.from.email === 'cliente@test.com', 'from parse');
  assert(payload?.textBody.includes('ajuda'), 'body parse');
}

function testInlineCidAttachmentsAreKept() {
  const parts = listGmailAttachmentParts({
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'image/png',
        filename: 'calendar.png',
        headers: [
          { name: 'Content-Disposition', value: 'inline; filename="calendar.png"' },
          { name: 'Content-ID', value: '<ii_calendar>' },
        ],
        body: { attachmentId: 'ATT1', size: 1200 },
      },
      {
        mimeType: 'image/png',
        filename: 'simbolo_velotax.png',
        headers: [
          { name: 'Content-Disposition', value: 'inline; filename="simbolo_velotax.png"' },
          { name: 'Content-ID', value: '<brand>' },
        ],
        body: { attachmentId: 'ATT2', size: 800 },
      },
      {
        mimeType: 'message/rfc822',
        filename: 'forwarded.eml',
        body: { attachmentId: 'ATT3', size: 5000 },
        parts: [
          {
            mimeType: 'image/png',
            filename: 'quoted-old.png',
            body: { attachmentId: 'ATT4', size: 900 },
          },
        ],
      },
    ],
  });

  assert(parts.length === 1, `esperava 1 anexo real, veio ${parts.length}`);
  assert(parts[0].filename === 'calendar.png', `filename: ${parts[0].filename}`);
}

function testAttachmentFingerprintMatch() {
  const known = new Set<string>([
    attachmentHashFingerprint('abc123'),
    attachmentSizeNameFingerprint('gpt.png', 2048),
  ]);

  assert(
    attachmentMatchesKnownFingerprints({ filename: 'gpt.png', contentHash: 'zzz', bytes: 2048 }, known),
    'size+name deveria casar',
  );
  assert(
    attachmentMatchesKnownFingerprints({ filename: 'outro.png', contentHash: 'abc123', bytes: 10 }, known),
    'hash deveria casar',
  );
  assert(
    !attachmentMatchesKnownFingerprints(
      { filename: 'gpt.png', contentHash: 'novo', bytes: 9999 },
      known,
    ),
    'nome sozinho NÃO pode casar',
  );
  assert(
    !known.has(attachmentNameFingerprint('gpt.png'))
      || !attachmentMatchesKnownFingerprints({ filename: 'gpt.png', bytes: 1 }, known),
    'fingerprint só de nome não bloqueia',
  );
}

function main() {
  testBuildProtocolSubject();
  testBuildRawRfc822();
  testComposeHtmlToEmailHtml();
  testBuildThreadSubject();
  testDecodePubSub();
  testGmailMessageParser();
  testInlineCidAttachmentsAreKept();
  testAttachmentFingerprintMatch();
  console.log('OK — smoke tests Gmail modules');
}

main();
