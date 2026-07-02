/**
 * composeFormatPreview v1.0.0 — preview visual de formatação no compose (textarea + mirror)
 * VERSION: v1.0.0 | DATE: 2026-07-02
 */

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Converte markdown legado + HTML permitido em HTML seguro para exibição */
export function composeMarkupToSafeHtml(raw) {
  let text = String(raw || '');

  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  text = text.replace(/<(\/?)(b|strong|i|em|u)\s*>/gi, '<$1$2>');

  const allowed = [];
  text = text.replace(/<\/?(?:b|strong|i|em|u)\s*>/gi, (tag) => {
    const key = `__TAG_${allowed.length}__`;
    allowed.push(tag.toLowerCase());
    return key;
  });

  text = escapeHtml(text);

  allowed.forEach((tag, index) => {
    text = text.replace(`__TAG_${index}__`, tag);
  });

  return text.replace(/\n/g, '<br />');
}

export function buildFormattedMirrorHtml(value, errors, activeErrorStartIndex) {
  const text = String(value || '');
  if (!text) return '\u00A0';

  const sorted = [...(errors || [])].sort((a, b) => a.startIndex - b.startIndex);
  if (!sorted.length) {
    return composeMarkupToSafeHtml(text) || '\u00A0';
  }

  let html = '';
  let cursor = 0;

  for (const error of sorted) {
    if (error.startIndex < cursor) continue;
    if (error.startIndex > text.length) continue;

    if (error.startIndex > cursor) {
      html += composeMarkupToSafeHtml(text.slice(cursor, error.startIndex));
    }

    const end = Math.min(error.endIndex, text.length);
    const chunk = composeMarkupToSafeHtml(text.slice(error.startIndex, end));
    const activeClass = error.startIndex === activeErrorStartIndex ? ' spell-textarea-mark--active' : '';
    html += `<mark class="spell-textarea-mark${activeClass}">${chunk || '\u00A0'}</mark>`;
    cursor = end;
  }

  if (cursor < text.length) {
    html += composeMarkupToSafeHtml(text.slice(cursor));
  }

  return html || '\u00A0';
}

export function composeTextHasFormatting(value) {
  return /(\*\*.+?\*\*|_.+?_|<(?:b|strong|i|em|u)\b)/i.test(String(value || ''));
}
