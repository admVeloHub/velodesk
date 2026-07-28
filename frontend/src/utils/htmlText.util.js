/**
 * htmlText.util v1.0.0 — normalização de texto HTML para exibição
 * VERSION: v1.0.0 | DATE: 2026-07-28
 */
export function decodeBasicHtmlEntities(text) {
  return String(text ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    });
}

/** Normaliza texto de mensagem para bolha no Desk (entidades + espaços). */
export function normalizeMessageDisplayText(raw) {
  return decodeBasicHtmlEntities(raw).replace(/\u00A0/g, ' ');
}
