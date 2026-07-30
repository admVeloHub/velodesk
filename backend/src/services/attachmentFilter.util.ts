/** attachmentFilter.util v1.2.0 — dedupe por hash/tamanho+nome (não só nome) */
import type { IChamadoN1 } from '../models/ChamadoN1';

const BRAND_INLINE_FILENAME_PATTERNS = [
  /simbolo_velotax/i,
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

export function attachmentNameFingerprint(filename: string): string {
  return `name:${String(filename || '').trim().toLowerCase()}`;
}

export function attachmentHashFingerprint(contentHash: string): string {
  return `hash:${String(contentHash || '').trim().toLowerCase()}`;
}

export function attachmentSizeNameFingerprint(filename: string, bytes: number): string {
  return `size:${bytes}|name:${String(filename || '').trim().toLowerCase()}`;
}

/** Coleta fingerprints já presentes no ticket para não reanexar arquivos da thread. */
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

/**
 * Match só por conteúdo (hash) ou tamanho+nome.
 * Nome sozinho NÃO basta — o Gmail/clientes reusam nomes (calendar.png, image.png)
 * e links mortos no ticket não podem bloquear um arquivo novo.
 */
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
