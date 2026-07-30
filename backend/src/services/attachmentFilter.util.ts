/** attachmentFilter.util v1.0.0 — ignora inline/logo de marca em anexos reais */

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
