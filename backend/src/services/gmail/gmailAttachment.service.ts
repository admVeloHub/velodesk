/** gmailAttachment.service v1.4.0 — aceita inline/CID com filename; só filtra logo da marca */
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

/**
 * Gmail costuma marcar prints/imagens do cliente como inline + Content-ID.
 * Não dá para descartar por disposition/CID — só a logo da marca Velotax.
 */
function shouldSkipGmailAttachmentPart(part: gmail_v1.Schema$MessagePart): boolean {
  const filename = String(part.filename ?? '').trim();
  if (!filename) return true;
  return isBrandInlineAttachmentFilename(filename);
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
  if (filename && attachmentId) {
    if (shouldSkipGmailAttachmentPart(part)) {
      console.info('[gmailAttachment] parte ignorada (logo/marca)', {
        filename,
        mimeType,
        disposition: getPartHeader(part, 'Content-Disposition') || null,
        contentId: getPartHeader(part, 'Content-ID') || null,
      });
    } else {
      acc.push({
        filename,
        mimeType: String(part.mimeType ?? 'application/octet-stream').trim(),
        attachmentId,
      });
    }
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
  if (!parts.length) {
    console.info('[gmailAttachment] nenhuma parte com filename+attachmentId', {
      messageId: messageIdForStorage,
      gmailId,
    });
    return [];
  }

  console.info('[gmailAttachment] partes candidatas', {
    messageId: messageIdForStorage,
    gmailId,
    count: parts.length,
    filenames: parts.map((part) => part.filename),
  });

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
      if (!raw) {
        console.warn('[gmailAttachment] attachmentId sem payload', {
          filename: part.filename,
          messageId: messageIdForStorage,
        });
        continue;
      }

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
          contentHash: contentHash.slice(0, 12),
          bytes: buffer.length,
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

      console.info('[gmailAttachment] anexo persistido', {
        filename: saved.filename,
        storageKey: saved.storageKey,
        gcsUri: saved.gcsUri,
        bytes: buffer.length,
        messageId: messageIdForStorage,
      });
    } catch (err) {
      console.error('[gmailAttachment] falha ao baixar/persistir anexo', {
        filename: part.filename,
        messageId: messageIdForStorage,
        error: (err as Error).message,
      });
    }
  }

  return stored;
}
