/**
 * emailReplyContent.util v1.0.0 — extrai só o conteúdo novo de respostas de e-mail
 * VERSION: v1.0.0 | DATE: 2026-07-27
 *
 * Remove cabeçalho de citação (Gmail/Outlook), linhas `>` e assinatura RFC 3676 (`-- `).
 * Data/hora já aparecem na label da bolha no Desk.
 */
const QUOTE_HEADER_PATTERNS: RegExp[] = [
  // Gmail PT: "Em seg., 27 de jul. de 2026 às 18:07, <email> escreveu:"
  /^Em\s.+?\sescreveu:\s*$/im,
  // Gmail EN: "On Mon, Jul 27, 2026 at 6:07 PM <email> wrote:"
  /^On\s.+?\swrote:\s*$/im,
  // Outlook
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^De:\s.+$/im,
  /^From:\s.+$/im,
];

/** Assinatura padrão: linha contendo apenas "-- " (RFC 3676). */
const SIGNATURE_DELIMITER = /^-- \s*$/m;

function cutAtFirstMatch(text: string, patterns: RegExp[]): string {
  let cutAt = text.length;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.index != null && match.index < cutAt) {
      cutAt = match.index;
    }
  }
  return text.slice(0, cutAt);
}

function stripQuotedLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*>/.test(line))
    .join('\n');
}

/**
 * Retorna apenas o trecho novo digitado pelo remetente.
 * Se não houver marcadores de citação, devolve o texto original (trimmed).
 */
export function extractEmailReplyContent(raw: string): string {
  let text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!text.trim()) return '';

  text = cutAtFirstMatch(text, QUOTE_HEADER_PATTERNS);
  text = stripQuotedLines(text);

  const sig = SIGNATURE_DELIMITER.exec(text);
  if (sig?.index != null) {
    text = text.slice(0, sig.index);
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}
