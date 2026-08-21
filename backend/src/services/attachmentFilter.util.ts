/** attachmentFilter.util v1.3.0 — fingerprints incluem anexosMensagemPublica outbound */
import type { IChamadoN1 } from '../models/ChamadoN1';

const BRAND_INLINE_FILENAME_PATTERNS = [
  /simbolo_velotax/i,
  /velotax_ajustada/i,
  /velotax_logo/i,
  /velotax.*logo/i,
  /^velodesk-brand/i,
  /^logo\.(png|jpe?g|gif|webp)$/i,
];

export function isBrandInlineAttachmentFilename(filename: string): boolean {
  const name = String(filename || '').trim();
  if (!name) return false;
  return BRAND_INLINE_FILENAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function filterRealAttachmentUrls(urls: string[] | undefined | null): string[] {
  return (urls || [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .filter((url) => !isBrandInlineAttachmentFilename(attachmentLabelFromUrl(url)));
}

export function attachmentLabelFromUrl(url: string): string {
  const raw = decodeURIComponent(String(url || '').split('/').pop() || 'Anexo');
  const withoutUuid = raw.replace(/^[0-9a-f-]{36}-/i, '');
  return withoutUuid.replace(/__/g, '/').split('/').pop() || 'Anexo';
}

/**
 * @deprecated Não usar em dedupe: dois anexos distintos podem ter o mesmo nome.
 * Preferir attachmentHashFingerprint ou attachmentSizeNameFingerprint.
 */
export function attachmentNameFingerprint(filename: string): string {
  return `name:${String(filename || '').trim().toLowerCase()}`;
}

export function attachmentHashFingerprint(contentHash: string): string {
  return `hash:${String(contentHash || '').trim().toLowerCase()}`;
}

export function attachmentSizeNameFingerprint(filename: string, bytes: number): string {
  return `size:${bytes}|name:${String(filename || '').trim().toLowerCase()}`;
}

export function attachmentUrlNameFingerprint(filename: string): string {
  return `urlname:${String(filename || '').trim().toLowerCase()}`;
}

export function attachmentUrlFingerprint(url: string): string {
  return `url:${String(url || '').trim().toLowerCase()}`;
}

function addUrlListFingerprints(fingerprints: Set<string>, urls: unknown): void {
  if (!Array.isArray(urls)) return;
  for (const raw of urls) {
    const url = String(raw ?? '').trim();
    if (!url) continue;
    fingerprints.add(attachmentUrlFingerprint(url));
    const label = attachmentLabelFromUrl(url);
    if (label && label !== 'Anexo') {
      fingerprints.add(attachmentUrlNameFingerprint(label));
    }
  }
}

/** Coleta fingerprints já presentes no ticket (inbound meta + outbound anexosMensagemPublica). */
export function collectChamadoAttachmentFingerprints(chamado: IChamadoN1 | null | undefined): Set<string> {
  const fingerprints = new Set<string>();
  if (!chamado?.registro?.length) return fingerprints;

  for (const reg of chamado.registro) {
    const meta = (reg.metadados ?? {}) as Record<string, unknown>;
    const emailAttachments = Array.isArray(meta.emailAttachments) ? meta.emailAttachments : [];
    for (const raw of emailAttachments) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const filename = String(item.filename ?? '').trim();
      const contentHash = String(item.contentHash ?? '').trim();
      const bytes = Number(item.bytes);
      if (contentHash) fingerprints.add(attachmentHashFingerprint(contentHash));
      if (filename && Number.isFinite(bytes) && bytes > 0) {
        fingerprints.add(attachmentSizeNameFingerprint(filename, bytes));
      }
      if (filename) fingerprints.add(attachmentUrlNameFingerprint(filename));
      const itemUrl = String(item.url ?? item.gcsUri ?? item.storageKey ?? '').trim();
      if (itemUrl) fingerprints.add(attachmentUrlFingerprint(itemUrl));
    }
    // Outbound do agente (e inbound sem meta): URLs em anexosMensagemPublica
    addUrlListFingerprints(fingerprints, reg.anexosMensagemPublica);
  }

  return fingerprints;
}

export function attachmentMatchesKnownFingerprints(
  item: { filename?: string; contentHash?: string; bytes?: number; url?: string },
  known: Set<string>,
): boolean {
  const filename = String(item.filename || '').trim();
  const contentHash = String(item.contentHash || '').trim();
  const bytes = Number(item.bytes);
  const url = String(item.url || '').trim();

  if (contentHash && known.has(attachmentHashFingerprint(contentHash))) return true;
  if (filename && Number.isFinite(bytes) && bytes > 0
    && known.has(attachmentSizeNameFingerprint(filename, bytes))) {
    return true;
  }
  // Eco de anexo já enviado pelo agente (só URL/nome no histórico)
  if (filename && known.has(attachmentUrlNameFingerprint(filename))) return true;
  if (url && known.has(attachmentUrlFingerprint(url))) return true;
  return false;
}
