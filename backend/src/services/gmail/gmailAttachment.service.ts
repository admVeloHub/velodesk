/** gmailAttachment.service v1.3.0 — ignora nested rfc822 + dedupe por fingerprint */
import crypto from 'crypto';
import type { gmail_v1 } from 'googleapis';
import type { InboundEmailAttachment } from '../inbound-email/types';
import {
  attachmentHashFingerprint,
  attachmentMatchesKnownFingerprints,
  attachmentNameFingerprint,
  attachmentSizeNameFingerprint,
  isBrandInlineAttachmentFilename,
} from '../attachmentFilter.util';
import { persistInboundAttachment } from '../inboundAttachmentStorage.service';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const NESTED_MESSAGE_MIME = new Set([
  'message/rfc822',
  'message/global',
  'message/partial',
  'message/external-body',
]);

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
  if (disposition.includes('inline') && !disposition.includes('attachment')) {
    return true;
  }

  if (getPartHeader(part, 'Content-ID')) {
    return true;
  }

  return false;
}

export function listGmailAttachmentParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  acc: GmailAttachmentPartRef[] = [],
): GmailAttachmentPartRef[] {
  if (!part) return acc;

  const mimeType = String(part.mimeType ?? '').trim().toLowerCase();
  if (NESTED_MESSAGE_MIME.has(mimeType)) {
    // Anexos de mensagens citadas/encaminhadas aninhadas — não pertencem a esta resposta.
    return acc;
  }

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
      const fingerprints = [
        attachmentHashFingerprint(contentHash),
        attachmentSizeNameFingerprint(part.filename, buffer.length),
        attachmentNameFingerprint(part.filename),
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
