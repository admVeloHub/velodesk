/** inboundAttachmentStorage v1.0.0 — persiste anexos de e-mail inbound em disco */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env';

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

function normalizeMessageFolder(messageId: string): string {
  const hash = crypto.createHash('sha1').update(String(messageId || 'msg')).digest('hex').slice(0, 16);
  return hash;
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
  filename: string;
  contentType: string;
  storageKey: string;
}

export async function persistInboundAttachment(
  input: PersistInboundAttachmentInput,
): Promise<StoredInboundAttachment> {
  const safeName = sanitizeFilename(input.filename);
  const folder = normalizeMessageFolder(input.messageId);
  const storageKey = `${folder}/${crypto.randomUUID()}-${safeName}`;
  const fullPath = path.join(resolveBaseDir(), storageKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, input.buffer);

  const encodedKey = storageKey.replace(/\//g, STORAGE_KEY_SEP);
  return {
    url: `/api/uploads/inbound/${encodeURIComponent(encodedKey)}`,
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

export async function ensureInboundAttachmentDir(): Promise<void> {
  await fs.mkdir(resolveBaseDir(), { recursive: true });
}
