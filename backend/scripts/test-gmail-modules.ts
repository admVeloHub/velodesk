/** test-gmail-modules.ts v1.0.0 — smoke test dos módulos Gmail (sem credenciais reais) */
import { buildProtocolSubject } from '../src/services/email-outbound.service';
import { buildRawRfc822 } from '../src/services/gmail/gmailApiSend';
import { decodePubSubMessage } from '../src/services/gmail/gmailInbound.service';
import { gmailMessageToInboundPayload, shouldSkipGmailMessage } from '../src/services/gmail/gmailMessageParser';

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
  });
  assert(raw.length > 10, 'raw vazio');
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
  testDecodePubSub();
  testGmailMessageParser();
  console.log('OK — smoke tests Gmail modules');
}

main();
