/**
 * emailReplyContent.util v1.1.0 — recorte de resposta mesmo com HTML do Gmail
 * VERSION: v1.1.0 | DATE: 2026-08-20
 *
 * Remove cabeçalho de citação (Gmail/Outlook), linhas `>`, assinatura RFC 3676
 * e casca HTML vazia. O header PT ("Em … escreveu:") costuma vir no mesmo
 * bloco HTML da resposta nova — não exige início de linha.
 */
import { htmlToPlainTextForEmail } from './emailHtml.util';

const QUOTE_HEADER_PATTERNS: RegExp[] = [
  // Gmail PT: "Em qui., 20 de ago. de 2026 às 16:21, <email> escreveu:"
  /Em\s[\s\S]{8,220}?(?:às|as)\s+\d{1,2}:\d{2}[\s\S]{0,160}?escreveu:\s*(?:<br\s*\/?>)?/i,
  // Gmail PT sem horário (Outlook/Apple)
  /Em\s[\s\S]{8,180}?escreveu:\s*(?:<br\s*\/?>)?/i,
  // Gmail EN: "On Mon, Jul 27, 2026 at 6:07 PM <email> wrote:"
  /On\s[\s\S]{8,220}?\swrote:\s*(?:<br\s*\/?>)?/i,
  // Outlook
  /-{2,}\s*Original Message\s*-{2,}/i,
  /(?:^|\n|<br\s*\/?>|<div>|<p>)\s*De:\s.+/im,
  /(?:^|\n|<br\s*\/?>|<div>|<p>)\s*From:\s.+/im,
];

/** Assinatura padrão: linha `-- ` (RFC 3676) ou `--` + quebra HTML. */
const SIGNATURE_DELIMITER = /(?:^|\n)--[ \t]*(?:\n|<br\s*\/?>|$)/;

const BRAND_ANEXO_LINE = /\[Anexo:\s*[^\]]*(?:velotax|velodesk-brand)[^\]]*\]/gi;

function cutAtFirstMatch(text: string, patterns: RegExp[]): string {
  let cutAt = text.length;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.index != null && match.index > 0 && match.index < cutAt) {
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

function stripEmptyHtmlWrappers(html: string): string {
  let text = html;
  for (let i = 0; i < 8; i += 1) {
    const next = text
      .replace(/<(div|p|span)>\s*<\/\1>/gi, '')
      .replace(/^(?:<br\s*\/?>|\s)+/gi, '')
      .replace(/(?:<br\s*\/?>|\s)+$/gi, '');
    if (next === text) break;
    text = next;
  }
  return text.trim();
}

function finalizeExtracted(text: string): string {
  let next = text.replace(BRAND_ANEXO_LINE, '');
  next = stripEmptyHtmlWrappers(next);
  const hasMeaningfulHtml = /<(img|ul|ol|li|strong|b|em|i|u)\b/i.test(next);
  if (!hasMeaningfulHtml && /<[a-z][\s\S]*>/i.test(next)) {
    next = htmlToPlainTextForEmail(next);
  }
  return next.replace(/\n{3,}/g, '\n\n').trim();
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
  if (sig?.index != null && sig.index > 0) {
    text = text.slice(0, sig.index);
  }

  return finalizeExtracted(text);
}
