/**
 * composeFormatPreview v1.1.0 — conversão segura de formatação para exibição
 * VERSION: v1.1.0 | DATE: 2026-08-21
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

export function composeTextHasFormatting(value) {
  return /(\*\*.+?\*\*|_.+?_|<(?:b|strong|i|em|u)\b)/i.test(String(value || ''));
}
