/**
 * composeTextFormat v1.0.0 — utilitários de formatação para textarea do compose
 * VERSION: v1.0.0 | DATE: 2026-07-02
 */

export function wrapTextSelection(value, selectionStart, selectionEnd, before, after) {
  const start = selectionStart ?? 0;
  const end = selectionEnd ?? start;
  const selected = value.substring(start, end);
  const next = `${value.substring(0, start)}${before}${selected}${after}${value.substring(end)}`;
  const newStart = start + before.length;
  const newEnd = newStart + selected.length;
  return { value: next, selectionStart: newStart, selectionEnd: newEnd };
}

export function prefixSelectedLines(value, selectionStart, selectionEnd, linePrefixFn) {
  let start = selectionStart ?? 0;
  let end = selectionEnd ?? start;

  if (start === end) {
    start = value.lastIndexOf('\n', start - 1) + 1;
    const nextNl = value.indexOf('\n', end);
    end = nextNl === -1 ? value.length : nextNl;
  }

  const block = value.substring(start, end);
  const lines = block.split('\n');
  const prefixed = lines
    .map((line, index) => {
      const prefix = linePrefixFn(index, line);
      if (!prefix) return line;
      return `${prefix}${line}`;
    })
    .join('\n');

  const next = value.substring(0, start) + prefixed + value.substring(end);
  return { value: next, selectionStart: start, selectionEnd: start + prefixed.length };
}

export function applyFormatAction(value, selectionStart, selectionEnd, action) {
  switch (action) {
    case 'bold':
      return wrapTextSelection(value, selectionStart, selectionEnd, '**', '**');
    case 'italic':
      return wrapTextSelection(value, selectionStart, selectionEnd, '_', '_');
    case 'underline':
      return wrapTextSelection(value, selectionStart, selectionEnd, '<u>', '</u>');
    case 'bulletList':
      return prefixSelectedLines(value, selectionStart, selectionEnd, () => '- ');
    case 'numberedList':
      return prefixSelectedLines(value, selectionStart, selectionEnd, (index) => `${index + 1}. `);
    default:
      return { value, selectionStart, selectionEnd };
  }
}

export function resolveFormatShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const key = String(event.key || '').toLowerCase();
  if (key === 'b') return 'bold';
  if (key === 'i') return 'italic';
  if (key === 'u') return 'underline';
  return null;
}
