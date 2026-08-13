/** inboundAttachmentStorage v1.6.0 — quarentena GCS; cache local só para skipped/clean */
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { env } from '../config/env';
import type { AttachmentScanStatus } from './attachmentGuard.util';
import {
  buildGcsObjectUri,
  getInboundAttachmentsPrefix,
  getInboundQuarantinePrefix,
  isGcsAttachmentStorageConfigured,
  inboundCleanObjectExists,
  readInboundAttachmentFromGcs,
  readQuarantineAttachmentMeta,
  uploadInboundAttachmentToGcs,
  uploadQuarantineAttachmentToGcs,
} from './gcsAttachmentStorage.service';
const STORAGE_KEY_SEP = '__';

function resolveBaseDir(): string {
  const configured = String(env.inboundAttachmentsDir || '').trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), 'data', 'inbound-attachments');
}

function sanitizeFilename(name: string): string {
  const base = path.basename(String(name || 'anexo').trim()) || 'anexo';
  return base.replace(/[^\w.\-()+\s]/g, '_').slice(0, 180);
}

function decodeStorageKey(rawKey: string): string {
  const raw = String(rawKey || '').trim();
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Nome com '%' literal — Express já entregou o valor decodificado.
    decoded = raw;
  }
  if (!decoded || decoded.includes('..') || decoded.includes('\\') || decoded.startsWith('/')) {
    throw new Error('Chave de anexo inválida');
  }
  return decoded.replace(new RegExp(STORAGE_KEY_SEP, 'g'), '/');
}

/**
 * Chaves alternativas para a mesma chave lógica, em ordem de tentativa.
 *
 * O separador `__` da URL é ambíguo: pode ser a subpasta do layout legado
 * (`messageId/uuid-nome`) ou `__` literal do nome do arquivo no layout flat atual.
 * Por isso testamos as duas leituras antes de desistir.
 */
export function expandInboundStorageKeyCandidates(relative: string): string[] {
  const normalized = String(relative || '').trim().replace(/\\/g, '/');
  if (!normalized) return [];

  const out = new Set<string>([normalized]);

  if (normalized.includes('/')) {
    out.add(normalized.replace(/\//g, STORAGE_KEY_SEP));
    out.add(normalized.split('/').filter(Boolean).pop() as string);
  }

  return [...out].filter(Boolean);
}

export interface PersistInboundAttachmentInput {
  messageId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
  scanStatus?: 'skipped' | 'pending';
}

export interface StoredInboundAttachment {
  url: string;
  gcsUri: string;
  filename: string;
  contentType: string;
  storageKey: string;
  scanStatus: AttachmentScanStatus;
}

export function buildInboundAttachmentApiUrl(storageKey: string): string {
  const encodedKey = storageKey.replace(/\//g, STORAGE_KEY_SEP);
  return `/api/uploads/inbound/${encodeURIComponent(encodedKey)}`;
}

export function parseInboundAttachmentStorageKeyFromApiUrl(apiUrl: string): string | null {
  const raw = String(apiUrl || '').trim();
  const match = raw.match(/\/(?:api\/)?uploads\/inbound\/([^?#]+)/i);
  if (!match?.[1]) return null;
  try {
    return decodeStorageKey(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export async function persistInboundAttachment(
  input: PersistInboundAttachmentInput,
): Promise<StoredInboundAttachment> {
  const safeName = sanitizeFilename(input.filename);
  const storageKey = `${crypto.randomUUID()}-${safeName}`;

  const canQuarantine = isGcsAttachmentStorageConfigured();
  const scanStatus: AttachmentScanStatus = input.scanStatus === 'pending' && canQuarantine
    ? 'pending'
    : 'skipped';
  const prefix = scanStatus === 'pending' ? getInboundQuarantinePrefix() : getInboundAttachmentsPrefix();
  const gcsUploaded = scanStatus === 'pending'
    ? await uploadQuarantineAttachmentToGcs(storageKey, input.buffer, input.contentType)
    : await uploadInboundAttachmentToGcs(storageKey, input.buffer, input.contentType);
  if (isGcsAttachmentStorageConfigured() && !gcsUploaded) {
    throw new Error(`Falha ao enviar anexo "${safeName}" para o bucket ${env.gcpStorageBucket}`);
  }
  if (env.nodeEnv === 'production' && !gcsUploaded) {
    throw new Error(
      `GCS indisponível em produção — anexo "${safeName}" não persistido (configure GCP_STORAGE_BUCKET e transport Gmail).`,
    );
  }

  if (scanStatus !== 'pending') {
    const fullPath = path.join(resolveBaseDir(), storageKey);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, input.buffer);
    } catch (err) {
      if (!gcsUploaded) throw err;
      console.warn('[inboundAttachment] cache local falhou (GCS ok):', (err as Error).message);
    }
  }

  console.info('[inboundAttachment] persistido', {
    storageKey,
    filename: safeName,
    bytes: input.buffer.length,
    gcs: gcsUploaded,
    scanStatus,
    prefix,
    messageId: String(input.messageId || '').slice(0, 32),
  });

  return {
    url: buildInboundAttachmentApiUrl(storageKey),
    gcsUri: buildGcsObjectUri(prefix, storageKey),
    filename: safeName,
    contentType: String(input.contentType || 'application/octet-stream').trim(),
    storageKey,
    scanStatus,
  };
}

/** Path em disco a partir de uma chave JÁ decodificada (não reaplica decode). */
function resolveDiskPathFromRelative(relative: string): string {
  const normalized = String(relative || '').trim().replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Chave de anexo inválida');
  }
  const base = resolveBaseDir();
  const fullPath = path.resolve(base, normalized);
  if (!fullPath.startsWith(base + path.sep) && fullPath !== base) {
    throw new Error('Caminho de anexo inválido');
  }
  return fullPath;
}

export function resolveInboundAttachmentPath(storageKey: string): string {
  return resolveDiskPathFromRelative(decodeStorageKey(storageKey));
}

export function decodeInboundStorageKeyParam(rawKey: string): string {
  return decodeStorageKey(rawKey);
}

async function tryOpenFromDisk(relative: string): Promise<{
  source: 'disk';
  filePath: string;
  filename: string;
} | null> {
  try {
    const filePath = resolveDiskPathFromRelative(relative);
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      return {
        source: 'disk',
        filePath,
        filename: path.basename(relative),
      };
    }
  } catch {
    // próximo candidato
  }
  return null;
}

export type InboundAttachmentGate =
  | { state: 'ready' }
  | { state: 'pending' }
  | { state: 'infected'; reason?: string }
  | { state: 'missing' };

export async function inspectInboundAttachmentGate(storageKey: string): Promise<InboundAttachmentGate> {
  const relative = decodeStorageKey(storageKey);
  const candidates = expandInboundStorageKeyCandidates(relative);

  for (const key of candidates) {
    const disk = await tryOpenFromDisk(key);
    if (disk) return { state: 'ready' };
    if (await inboundCleanObjectExists(key)) return { state: 'ready' };
  }

  for (const key of candidates) {
    const meta = await readQuarantineAttachmentMeta(key);
    if (!meta) continue;
    const status = String(meta.scanStatus || 'pending').toLowerCase();
    if (status === 'infected') return { state: 'infected', reason: meta.scanReason };
    if (status === 'unscannable') return { state: 'infected', reason: meta.scanReason || 'unscannable' };
    return { state: 'pending' };
  }

  return { state: 'missing' };
}

export async function openInboundAttachment(storageKey: string): Promise<{
  source: 'disk' | 'gcs';
  filePath?: string;
  stream?: NodeJS.ReadableStream;
  contentType?: string;
  filename: string;
} | null> {
  const relative = decodeStorageKey(storageKey);
  const candidates = expandInboundStorageKeyCandidates(relative);

  for (const key of candidates) {
    const disk = await tryOpenFromDisk(key);
    if (disk) return disk;

    const gcs = await readInboundAttachmentFromGcs(key);
    if (gcs) {
      return {
        source: 'gcs',
        stream: gcs.stream,
        contentType: gcs.contentType,
        filename: path.basename(key),
      };
    }
  }

  console.warn('[inboundAttachment] não encontrado', { storageKey: relative, tried: candidates });
  return null;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function readInboundAttachmentBuffer(
  storageKey: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
  const opened = await openInboundAttachment(storageKey);
  if (!opened) return null;
  if (opened.source === 'disk' && opened.filePath) {
    return {
      buffer: await fs.readFile(opened.filePath),
      filename: opened.filename,
      contentType: opened.contentType || 'application/octet-stream',
    };
  }
  if (opened.stream) {
    return {
      buffer: await streamToBuffer(opened.stream),
      filename: opened.filename,
      contentType: opened.contentType || 'application/octet-stream',
    };
  }
  return null;
}

export function createDiskReadStream(filePath: string) {
  return createReadStream(filePath);
}

export async function ensureInboundAttachmentDir(): Promise<void> {
  await fs.mkdir(resolveBaseDir(), { recursive: true });
}
