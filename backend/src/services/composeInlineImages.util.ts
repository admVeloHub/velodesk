/**
 * composeInlineImages.util v1.0.0 — extrai data:image do HTML do compose para CID no e-mail
 * VERSION: v1.0.0 | DATE: 2026-08-12
 */
import type { GmailInlineImage } from './gmail/gmailApiSend';

const DATA_IMG_RE = /<img\b[^>]*\bsrc\s*=\s*["'](data:image\/([a-z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+))["'][^>]*>/gi;

function extForMime(mime: string): string {
  const m = String(mime || '').toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('gif')) return 'gif';
  if (m.includes('webp')) return 'webp';
  return 'png';
}

/**
 * Substitui data:image no HTML por cid: e devolve buffers para multipart/related.
 */
export function extractComposeInlineImages(html: string): {
  html: string;
  inlineImages: GmailInlineImage[];
} {
  const inlineImages: GmailInlineImage[] = [];
  let index = 0;
  const nextHtml = String(html ?? '').replace(DATA_IMG_RE, (full, _dataUrl, subtype, b64) => {
    const mime = `image/${String(subtype || 'png').toLowerCase()}`;
    const buffer = Buffer.from(String(b64 || '').replace(/\s+/g, ''), 'base64');
    if (!buffer.length) return full;
    index += 1;
    const cid = `compose-inline-${index}@velodesk`;
    inlineImages.push({
      cid,
      filename: `imagem-${index}.${extForMime(mime)}`,
      contentType: mime,
      buffer,
    });
    return full.replace(/\bsrc\s*=\s*["']data:image\/[^"']+["']/i, `src="cid:${cid}"`);
  });
  return { html: nextHtml, inlineImages };
}
