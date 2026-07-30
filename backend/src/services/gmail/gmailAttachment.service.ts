/** gmailAttachment.service v1.4.1 — Content-ID não bloqueia attachment; percorre message/rfc822 */
import crypto from 'crypto';
import type { gmail_v1 } from 'googleapis';
import type { InboundEmailAttachment } from '../inbound-email/types';
import {
  attachmentHashFingerprint,
  attachmentMatchesKnownFingerprints,
  attachmentSizeNameFingerprint,
  isBrandInlineAttachmentFilename,
} from '../attachmentFilter.util';
import { persistInboundAttachment } from '../inboundAttachmentStorage.service';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface GmailAttachmentPartRef {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

function decodeBase64Url(data: string): Buffer {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function getPartHeader(part: gmail_v1.Schema$MessagePart, name: string): string {
  const found = part.headers?.find(
    (header) => String(header.name ?? '').toLowerCase() === name.toLowerCase(),
  );
  return String(found?.value ?? '').trim();
}

function shouldSkipGmailAttachmentPart(part: gmail_v1.Schema$MessagePart): boolean {
  const filename = String(part.filename ?? '').trim();
  if (!filename) return true;

  if (isBrandInlineAttachmentFilename(filename)) {
    return true;
  }

  const disposition = getPartHeader(part, 'Content-Disposition').toLowerCase();
  const isExplicitAttachment = disposition.includes('attachment');

  if (disposition.includes('inline') && !isExplicitAttachment) {
    return true;
  }

  // Content-ID indica inline (logo/CID) — mas não quando disposition=attachment
  if (!isExplicitAttachment && getPartHeader(part, 'Content-ID')) {
    return true;
  }

  return false;
}

export function listGmailAttachmentParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: GmailAttachmentPartRef[] = [],
): GmailAttachmentPartRef[] {
  if (!part) return acc;

  // message/rfc822 (e-mail encaminhado) não interrompe a descida: o container pode ser
  // o próprio .eml anexado e/ou trazer anexos aninhados nas sub-partes.
  const filename = String(part.filename ?? '').trim();
  const attachmentId = String(part.body?.attachmentId ?? '').trim();
  if (filename && attachmentId && !shouldSkipGmailAttachmentPart(part)) {
    acc.push({
      filename,
      mimeType: String(part.mimeType ?? 'application/octet-stream').trim(),
      attachmentId,
    });
  }

  for (const child of part.parts ?? []) {
    listGmailAttachmentParts(child, acc);
  }
  return acc;
}

export async function downloadGmailAttachments(
  gmail: gmail_v1.Gmail,
  message: gmail_v1.Schema$Message,
  messageIdForStorage: string,
  knownFingerprints: Set<string> = new Set(),
): Promise<InboundEmailAttachment[]> {
  const gmailId = String(message.id ?? '').trim();
  if (!gmailId) return [];

  const parts = listGmailAttachmentParts(message.payload ?? undefined);
  if (!parts.length) return [];

  const stored: InboundEmailAttachment[] = [];
  const seenInMessage = new Set<string>();

  for (const part of parts) {
    try {
      const res = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: gmailId,
        id: part.attachmentId,
      });
      const raw = String(res.data.data ?? '').trim();
      if (!raw) continue;

      const buffer = decodeBase64Url(raw);
      if (buffer.length > MAX_ATTACHMENT_BYTES) {
        console.warn('[gmailAttachment] anexo ignorado (tamanho)', {
          filename: part.filename,
          bytes: buffer.length,
          messageId: messageIdForStorage,
        });
        continue;
      }

      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
      // Sem fingerprint por nome isolado: arquivos homônimos com conteúdo distinto são anexos válidos.
      const fingerprints = [
        attachmentHashFingerprint(contentHash),
        attachmentSizeNameFingerprint(part.filename, buffer.length),
      ];

      if (fingerprints.some((fp) => seenInMessage.has(fp))) {
        console.info('[gmailAttachment] anexo duplicado na mesma mensagem — ignorado', {
          filename: part.filename,
          messageId: messageIdForStorage,
        });
        continue;
      }

      if (attachmentMatchesKnownFingerprints(
        { filename: part.filename, contentHash, bytes: buffer.length },
        knownFingerprints,
      )) {
        console.info('[gmailAttachment] anexo já presente no ticket — ignorado', {
          filename: part.filename,
          messageId: messageIdForStorage,
        });
        continue;
      }

      const saved = await persistInboundAttachment({
        messageId: messageIdForStorage,
        filename: part.filename,
        contentType: part.mimeType,
        buffer,
      });

      for (const fp of fingerprints) {
        seenInMessage.add(fp);
        knownFingerprints.add(fp);
      }

      stored.push({
        filename: saved.filename,
        contentType: saved.contentType,
        url: saved.url,
        gcsUri: saved.gcsUri,
        storageKey: saved.storageKey,
        contentHash,
        bytes: buffer.length,
      });
    } catch (err) {
      console.warn('[gmailAttachment] falha ao baixar anexo', {
        filename: part.filename,
        messageId: messageIdForStorage,
        error: (err as Error).message,
      });
    }
  }

  return stored;
}
