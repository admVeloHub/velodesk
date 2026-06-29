/**
 * tokenize v1.0.2 — tokenização de palavras para corretor ortográfico
 * VERSION: v1.0.2 | DATE: 2026-06-26
 */

const WORD_CHARS = /[\p{L}\p{M}]+/u;

/** @param {string} text */
/** @param {number} cursorPos */
export function getLastWordBeforeCursor(text, cursorPos) {
  const before = text.slice(0, cursorPos);
  const match = before.match(/([\p{L}\p{M}]+)$/u);
  if (!match) return null;
  const word = match[1];
  return {
    word,
    startIndex: cursorPos - word.length,
    endIndex: cursorPos,
  };
}

/** @param {string} text @param {number} cursorPos */
export function getWordAtCursor(text, cursorPos) {
  const tokens = tokenizeText(text);
  for (const token of tokens) {
    if (cursorPos >= token.startIndex && cursorPos <= token.endIndex) {
      return token;
    }
  }
  return getLastWordBeforeCursor(text, cursorPos);
}

/** @param {string} text @param {Array<{ startIndex: number, endIndex: number }>} errors */
export function findFlaggedErrorAtCursor(text, cursorPos, errors) {
  const wordInfo = getWordAtCursor(text, cursorPos);
  if (!wordInfo) return null;
  return errors.find(
    (error) => error.startIndex === wordInfo.startIndex
      && text.slice(error.startIndex, error.endIndex) === error.word,
  ) || null;
}

/** @param {string} text */
export function tokenizeText(text) {
  const tokens = [];
  const regex = new RegExp(WORD_CHARS.source, 'gu');
  let match = regex.exec(text);
  while (match) {
    tokens.push({
      word: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
    match = regex.exec(text);
  }
  return tokens;
}

/**
 * @param {string} text
 * @param {number} startIndex
 * @param {string} word
 */
export function replaceWordAt(text, startIndex, word, replacement) {
  const endIndex = startIndex + word.length;
  if (text.slice(startIndex, endIndex) !== word) return text;
  return text.slice(0, startIndex) + replacement + text.slice(endIndex);
}
