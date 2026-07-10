/** test-gmail-modules.ts v1.1.0 — smoke test Gmail + HTML e-mail */
import { buildProtocolSubject } from '../src/services/email-outbound.service';
import { buildRawRfc822 } from '../src/services/gmail/gmailApiSend';
import { decodePubSubMessage } from '../src/services/gmail/gmailInbound.service';
import { gmailMessageToInboundPayload, shouldSkipGmailMessage } from '../src/services/gmail/gmailMessageParser';
import { composeHtmlToEmailHtml } from '../src/services/emailHtml.util';
import { buildThreadSubject } from '../src/services/emailThread.service';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testBuildProtocolSubject() {
  const s = buildProtocolSubject('0100177678', 'Duvida');
  assert(s === '[0100177678] Duvida', `subject: ${s}`);
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
  assert(first === '[0100177678] Dúvida', `first: ${first}`);
  assert(reply === 'Re: [0100177678] Dúvida', `reply: ${reply}`);
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

function main() {
  testBuildProtocolSubject();
  testBuildRawRfc822();
  testComposeHtmlToEmailHtml();
  testBuildThreadSubject();
  testDecodePubSub();
  testGmailMessageParser();
  console.log('OK — smoke tests Gmail modules');
}

main();
