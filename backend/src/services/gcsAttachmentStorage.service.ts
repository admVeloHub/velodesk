/** gcsAttachmentStorage v1.4.0 — prefixos inbound/sent/octadesk-legacy; "No such object" = miss silencioso */
import { Readable } from 'stream';
import { google } from 'googleapis';
import { env } from '../config/env';
import { getEmailTransportSnapshot, isEmailTransportReady } from './emailTransport.service';

const GCS_SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

function normalizePrefix(prefix: string): string {
  return String(prefix || '').trim().replace(/^\/+|\/+$/g, '');
}

export function getInboundAttachmentsPrefix(): string {
  return normalizePrefix(env.gcpStorageInboundAttachmentsPrefix || 'desk_ticket_attachments');
}

export function getSentAttachmentsPrefix(): string {
  return normalizePrefix(env.gcpStorageSentAttachmentsPrefix || 'desk_ticket_sent_attachments');
}

export function getOctadeskLegacyAttachmentsPrefix(): string {
  return normalizePrefix(
    env.gcpStorageOctadeskLegacyAttachmentsPrefix || 'octadesk_legacy_attachments',
  );
}

export function isGcsAttachmentStorageConfigured(): boolean {
  return Boolean(String(env.gcpStorageBucket || '').trim()) && isEmailTransportReady();
}

export function buildGcsObjectUri(prefix: string, storageKey: string): string {
  const bucket = String(env.gcpStorageBucket || '').trim();
  return `gs://${bucket}/${objectName(prefix, storageKey)}`;
}

async function createStorageClient() {
  const snap = getEmailTransportSnapshot();
  if (!snap) throw new Error('Service account indisponível para GCS');

  const auth = new google.auth.JWT({
    email: snap.serviceAccountJson.client_email,
    key: snap.serviceAccountJson.private_key,
    scopes: [GCS_SCOPE],
  });
  await auth.authorize();
  return google.storage({ version: 'v1', auth });
}

function objectName(prefix: string, storageKey: string): string {
  return `${normalizePrefix(prefix)}/${storageKey.replace(/\\/g, '/')}`;
}

export async function uploadAttachmentToGcs(
  prefix: string,
  storageKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<boolean> {
  if (!isGcsAttachmentStorageConfigured()) return false;

  try {
    const storage = await createStorageClient();
    const name = objectName(prefix, storageKey);
    await storage.objects.insert({
      bucket: env.gcpStorageBucket,
      requestBody: {
        name,
        contentType: String(contentType || 'application/octet-stream').trim(),
      },
      media: {
        mimeType: String(contentType || 'application/octet-stream').trim(),
        body: Readable.from(buffer),
      },
    });
    console.info('[gcsAttachment] upload ok', { prefix: normalizePrefix(prefix), object: name, bytes: buffer.length });
    return true;
  } catch (err) {
    console.error('[gcsAttachment] upload falhou:', {
      prefix: normalizePrefix(prefix),
      storageKey,
      bucket: env.gcpStorageBucket,
      error: (err as Error).message,
    });
    return false;
  }
}

export async function readAttachmentFromGcs(
  prefix: string,
  storageKey: string,
): Promise<{ stream: Readable; contentType: string } | null> {
  if (!isGcsAttachmentStorageConfigured()) return null;

  try {
    const storage = await createStorageClient();
    const res = await storage.objects.get(
      {
        bucket: env.gcpStorageBucket,
        object: objectName(prefix, storageKey),
        alt: 'media',
      },
      { responseType: 'stream' },
    );

    const stream = res.data as unknown as Readable;
    if (!stream) return null;

    const contentType = String(res.headers?.['content-type'] || 'application/octet-stream').trim();
    return { stream, contentType };
  } catch (err) {
    const message = (err as Error).message || '';
    // GCS devolve "No such object: bucket/path" (sem "404"/"not found" literais).
    if (!/404|not found|no such object/i.test(message)) {
      console.warn('[gcsAttachment] leitura falhou:', { prefix: normalizePrefix(prefix), storageKey, error: message });
    }
    return null;
  }
}

export async function uploadInboundAttachmentToGcs(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<boolean> {
  return uploadAttachmentToGcs(getInboundAttachmentsPrefix(), storageKey, buffer, contentType);
}

export async function readInboundAttachmentFromGcs(
  storageKey: string,
): Promise<{ stream: Readable; contentType: string } | null> {
  return readAttachmentFromGcs(getInboundAttachmentsPrefix(), storageKey);
}

export async function uploadSentAttachmentToGcs(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<boolean> {
  return uploadAttachmentToGcs(getSentAttachmentsPrefix(), storageKey, buffer, contentType);
}

export async function readSentAttachmentFromGcs(
  storageKey: string,
): Promise<{ stream: Readable; contentType: string } | null> {
  return readAttachmentFromGcs(getSentAttachmentsPrefix(), storageKey);
}

export async function uploadOctadeskLegacyAttachmentToGcs(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<boolean> {
  return uploadAttachmentToGcs(getOctadeskLegacyAttachmentsPrefix(), storageKey, buffer, contentType);
}

export async function readOctadeskLegacyAttachmentFromGcs(
  storageKey: string,
): Promise<{ stream: Readable; contentType: string } | null> {
  return readAttachmentFromGcs(getOctadeskLegacyAttachmentsPrefix(), storageKey);
}
