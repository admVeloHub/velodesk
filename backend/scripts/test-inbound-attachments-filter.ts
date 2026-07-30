/** test-inbound-attachments-filter.ts v1.0.0 — valida inline/CID e fingerprints */
import { listGmailAttachmentParts } from '../src/services/gmail/gmailAttachment.service';
import {
  attachmentHashFingerprint,
  attachmentMatchesKnownFingerprints,
  attachmentNameFingerprint,
  attachmentSizeNameFingerprint,
} from '../src/services/attachmentFilter.util';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
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
      {
        mimeType: 'application/pdf',
        filename: 'contrato.pdf',
        headers: [{ name: 'Content-Disposition', value: 'attachment; filename="contrato.pdf"' }],
        body: { attachmentId: 'ATT5', size: 4000 },
      },
    ],
  });

  assert(parts.length === 2, `esperava 2 anexos reais, veio ${parts.length}`);
  assert(parts.some((p) => p.filename === 'calendar.png'), 'calendar.png ausente');
  assert(parts.some((p) => p.filename === 'contrato.pdf'), 'contrato.pdf ausente');
  assert(!parts.some((p) => p.filename === 'simbolo_velotax.png'), 'logo da marca nao deveria entrar');
  assert(!parts.some((p) => p.filename === 'quoted-old.png'), 'anexo de rfc822 nao deveria entrar');
}

function testAttachmentFingerprintMatch() {
  const known = new Set<string>([
    attachmentHashFingerprint('abc123'),
    attachmentSizeNameFingerprint('gpt.png', 2048),
    attachmentNameFingerprint('gpt.png'),
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
    'nome sozinho NAO pode casar',
  );
}

testInlineCidAttachmentsAreKept();
testAttachmentFingerprintMatch();
console.log('OK inbound attachments filter');
