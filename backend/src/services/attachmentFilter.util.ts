/** attachmentFilter.util v1.2.1 — logo velotax_ajustada também é marca, não anexo do cliente */
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

/** Coleta fingerprints já presentes no ticket (hash e tamanho+nome — não só nome). */
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
    }
  }

  return fingerprints;
}

export function attachmentMatchesKnownFingerprints(
  item: { filename?: string; contentHash?: string; bytes?: number },
  known: Set<string>,
): boolean {
  const filename = String(item.filename || '').trim();
  const contentHash = String(item.contentHash || '').trim();
  const bytes = Number(item.bytes);

  if (contentHash && known.has(attachmentHashFingerprint(contentHash))) return true;
  if (filename && Number.isFinite(bytes) && bytes > 0
    && known.has(attachmentSizeNameFingerprint(filename, bytes))) {
    return true;
  }
  return false;
}
