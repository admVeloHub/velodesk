/** inboundAttachmentStorage v1.3.2 — flat no prefixo inbound; exige GCS quando bucket configurado */
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';
import {
  buildGcsObjectUri,
  getInboundAttachmentsPrefix,
  isGcsAttachmentStorageConfigured,
  readInboundAttachmentFromGcs,
  uploadInboundAttachmentToGcs,
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
  const decoded = decodeURIComponent(String(rawKey || '').trim());
  if (!decoded || decoded.includes('..') || decoded.includes('\\') || decoded.startsWith('/')) {
    throw new Error('Chave de anexo inválida');
  }
  return decoded.replace(new RegExp(STORAGE_KEY_SEP, 'g'), '/');
}

export interface PersistInboundAttachmentInput {
  messageId: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface StoredInboundAttachment {
  url: string;
  gcsUri: string;
  filename: string;
  contentType: string;
  storageKey: string;
}

export function buildInboundAttachmentApiUrl(storageKey: string): string {
  const encodedKey = storageKey.replace(/\//g, STORAGE_KEY_SEP);
  return `/api/uploads/inbound/${encodeURIComponent(encodedKey)}`;
}

export async function persistInboundAttachment(
  input: PersistInboundAttachmentInput,
): Promise<StoredInboundAttachment> {
  const safeName = sanitizeFilename(input.filename);
  const storageKey = `${crypto.randomUUID()}-${safeName}`;

  const bucket = String(env.gcpStorageBucket || '').trim();
  // Em Cloud Run o disco é efêmero: com bucket definido o upload GCS é obrigatório.
  if (bucket && !isGcsAttachmentStorageConfigured()) {
    throw new Error(
      `GCS bucket "${bucket}" definido, mas transport/credencial indisponível — anexo "${safeName}" não pode ser persistido só em disco`,
    );
  }

  const gcsConfigured = isGcsAttachmentStorageConfigured();
  const gcsUploaded = await uploadInboundAttachmentToGcs(
    storageKey,
    input.buffer,
    input.contentType,
  );
  if (gcsConfigured && !gcsUploaded) {
    throw new Error(`Falha ao enviar anexo "${safeName}" para o bucket ${bucket}`);
  }
  if (!gcsConfigured) {
    console.warn('[inboundAttachment] GCS sem bucket — persistindo só em disco local (dev)', {
      storageKey,
      filename: safeName,
    });
  }

  const fullPath = path.join(resolveBaseDir(), storageKey);
  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);
  } catch (err) {
    if (!gcsUploaded) throw err;
    console.warn('[inboundAttachment] cache local falhou (GCS ok):', (err as Error).message);
  }

  console.info('[inboundAttachment] persistido', {
    storageKey,
    filename: safeName,
    bytes: input.buffer.length,
    gcsUploaded,
    gcsUri: buildGcsObjectUri(getInboundAttachmentsPrefix(), storageKey),
  });

  return {
    url: buildInboundAttachmentApiUrl(storageKey),
    gcsUri: buildGcsObjectUri(getInboundAttachmentsPrefix(), storageKey),
    filename: safeName,
    contentType: String(input.contentType || 'application/octet-stream').trim(),
    storageKey,
  };
}
export function resolveInboundAttachmentPath(storageKey: string): string {
  const relative = decodeStorageKey(storageKey);
  const base = resolveBaseDir();
  const fullPath = path.resolve(base, relative);
  if (!fullPath.startsWith(base + path.sep) && fullPath !== base) {
    throw new Error('Caminho de anexo inválido');
  }
  return fullPath;
}

export function decodeInboundStorageKeyParam(rawKey: string): string {
  return decodeStorageKey(rawKey);
}

export async function openInboundAttachment(storageKey: string): Promise<{
  source: 'disk' | 'gcs';
  filePath?: string;
  stream?: NodeJS.ReadableStream;
  contentType?: string;
  filename: string;
} | null> {
  const relative = decodeStorageKey(storageKey);
  const filePath = resolveInboundAttachmentPath(storageKey);

  try {
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      return {
        source: 'disk',
        filePath,
        filename: path.basename(relative),
      };
    }
  } catch {
    // tenta GCS
  }

  const gcs = await readInboundAttachmentFromGcs(relative);
  if (gcs) {
    return {
      source: 'gcs',
      stream: gcs.stream,
      contentType: gcs.contentType,
      filename: path.basename(relative),
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
