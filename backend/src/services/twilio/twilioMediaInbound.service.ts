/** twilioMediaInbound.service v1.1.0 — attachmentGuard antes de persistir */
import path from 'path';
import { env } from '../../config/env';
import { inspectAttachmentGuard } from '../attachmentGuard.util';
import {
  persistInboundAttachment,
  type StoredInboundAttachment,
} from '../inboundAttachmentStorage.service';
import type { TwilioWhatsAppInboundMedia } from './whatsappInbound.types';

const MAX_WHATSAPP_MEDIA_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
  'audio/amr': '.amr',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/vcard': '.vcf',
};

export interface PersistedTwilioInboundMedia extends StoredInboundAttachment {
  index: number;
}

function isAllowedTwilioMediaHost(hostname: string): boolean {
  const host = String(hostname || '').toLowerCase();
  return host === 'api.twilio.com'
    || host === 'mms.twiliocdn.com'
    || host.endsWith('.twilio.com')
    || host.endsWith('.twiliocdn.com');
}

function resolveMediaAuth(accountSid: string): { username: string; password: string } {
  const sid = String(accountSid || '').trim();
  const parentSid = env.twilioAccountSid.trim();
  const subSid = env.twilioSubaccountSid.trim();

  if (sid && sid === subSid && env.twilioSubaccountAuthToken.trim()) {
    return { username: subSid, password: env.twilioSubaccountAuthToken.trim() };
  }
  if (sid && sid === parentSid && env.twilioAuthToken.trim()) {
    return { username: parentSid, password: env.twilioAuthToken.trim() };
  }
  if (parentSid && env.twilioAuthToken.trim()) {
    return { username: parentSid, password: env.twilioAuthToken.trim() };
  }
  if (subSid && env.twilioSubaccountAuthToken.trim()) {
    return { username: subSid, password: env.twilioSubaccountAuthToken.trim() };
  }
  throw new Error(`Credencial Twilio indisponível para AccountSid ${sid || '(ausente)'}`);
}

function inferFilename(
  messageSid: string,
  index: number,
  contentType: string,
  contentDisposition: string,
): string {
  const dispositionMatch = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition);
  if (dispositionMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(dispositionMatch[1].replace(/^"|"$/g, '').trim());
      if (decoded) return path.basename(decoded);
    } catch {
      // usa nome inferido
    }
  }
  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  const extension = CONTENT_TYPE_EXTENSIONS[normalizedType] || '.bin';
  return `whatsapp-${messageSid || 'media'}-${index}${extension}`;
}

async function readResponseWithLimit(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_WHATSAPP_MEDIA_BYTES) {
    throw new Error(`Mídia WhatsApp excede ${MAX_WHATSAPP_MEDIA_BYTES / (1024 * 1024)}MB`);
  }
  if (!response.body) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const rawChunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    const chunk = Buffer.from(rawChunk);
    total += chunk.length;
    if (total > MAX_WHATSAPP_MEDIA_BYTES) {
      throw new Error(`Mídia WhatsApp excede ${MAX_WHATSAPP_MEDIA_BYTES / (1024 * 1024)}MB`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseTwilioInboundMedia(
  raw: Record<string, string>,
  numMedia: number,
): TwilioWhatsAppInboundMedia[] {
  const items: TwilioWhatsAppInboundMedia[] = [];
  for (let index = 0; index < Math.max(0, numMedia); index += 1) {
    const url = String(raw[`MediaUrl${index}`] || '').trim();
    if (!url) continue;
    items.push({
      index,
      url,
      contentType: String(raw[`MediaContentType${index}`] || 'application/octet-stream')
        .split(';')[0]
        .trim()
        .toLowerCase(),
    });
  }
  return items;
}

async function downloadAndPersistOne(
  messageSid: string,
  accountSid: string,
  media: TwilioWhatsAppInboundMedia,
): Promise<PersistedTwilioInboundMedia> {
  const parsedUrl = new URL(media.url);
  if (parsedUrl.protocol !== 'https:' || !isAllowedTwilioMediaHost(parsedUrl.hostname)) {
    throw new Error(`URL de mídia Twilio não autorizada: ${parsedUrl.hostname}`);
  }

  const credentials = resolveMediaAuth(accountSid);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    const response = await fetch(media.url, {
      headers: { Authorization: `Basic ${auth}` },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Download mídia Twilio falhou: HTTP ${response.status}`);
    }

    const buffer = await readResponseWithLimit(response);
    if (!buffer.length) throw new Error('Mídia Twilio vazia');

    const responseType = String(response.headers.get('content-type') || '').split(';')[0].trim();
    const contentType = responseType || media.contentType || 'application/octet-stream';
    const filename = inferFilename(
      messageSid,
      media.index,
      contentType,
      String(response.headers.get('content-disposition') || ''),
    );
    const guard = inspectAttachmentGuard(filename, contentType, buffer);
    if (!guard.ok) {
      throw new Error(`Mídia WhatsApp bloqueada: ${guard.reason}`);
    }
    const stored = await persistInboundAttachment({
      messageId: messageSid,
      filename,
      contentType: guard.detectedMime || contentType,
      buffer,
      scanStatus: guard.scanStatus,
    });
    return { ...stored, index: media.index };
  } finally {
    clearTimeout(timeout);
  }
}

export async function persistTwilioInboundMedia(
  messageSid: string,
  accountSid: string,
  media: TwilioWhatsAppInboundMedia[],
): Promise<PersistedTwilioInboundMedia[]> {
  const stored: PersistedTwilioInboundMedia[] = [];
  for (const item of media) {
    try {
      stored.push(await downloadAndPersistOne(messageSid, accountSid, item));
    } catch (err) {
      console.warn('[twilioMediaInbound] mídia ignorada', {
        messageSid,
        index: item.index,
        error: (err as Error).message,
      });
    }
  }
  return stored;
}
