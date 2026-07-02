/**
 * composeRichEditor v1.0.1 — contenteditable WYSIWYG do compose
 * VERSION: v1.0.1 | DATE: 2026-07-02
 */

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI']);

const FORMAT_COMMANDS = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  bulletList: 'insertUnorderedList',
  numberedList: 'insertOrderedList',
};

export function htmlToPlainText(html) {
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) return String(html || '');
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return (div.innerText || div.textContent || '').replace(/\u00A0/g, ' ');
}

export function composeTextHasFormatting(value) {
  return /(\*\*.+?\*\*|_.+?_|<(?:b|strong|i|em|u)\b)/i.test(String(value || ''));
}

export function normalizePlainToHtml(text) {
  const raw = String(text || '');
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return sanitizeComposeHtml(raw);
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

export function sanitizeComposeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          const fragment = document.createDocumentFragment();
          while (el.firstChild) fragment.appendChild(el.firstChild);
          el.replaceWith(fragment);
          walk(fragment);
          return;
        }
        [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
        walk(el);
        return;
      }
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
      }
    });
  };

  walk(template.content);
  return template.innerHTML.replace(/<div><br><\/div>/gi, '<br />');
}

export function execComposeFormat(root, action) {
  if (!root) return;
  root.focus();
  const command = FORMAT_COMMANDS[action];
  if (!command) return;
  try {
    document.execCommand(command, false, null);
  } catch {
    /* execCommand indisponível */
  }
}

/** Estado ativo das formatações na seleção/cursor atual */
export function readComposeFormatState(root) {
  if (!root || document.activeElement !== root) {
    return {
      bold: false,
      italic: false,
      underline: false,
      bulletList: false,
      numberedList: false,
    };
  }
  const query = (command) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  return {
    bold: query('bold'),
    italic: query('italic'),
    underline: query('underline'),
    bulletList: query('insertUnorderedList'),
    numberedList: query('insertOrderedList'),
  };
}

export function getPlainOffset(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return root ? htmlToPlainText(root.innerHTML).length : 0;
  const range = selection.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function getRangeAtPlainOffset(root, startIndex, deleteCount) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let startNode = null;
  let startOff = 0;
  let endNode = null;
  let endOff = 0;
  const endIndex = startIndex + deleteCount;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const len = node.textContent?.length || 0;
    if (startNode == null && startIndex <= offset + len) {
      startNode = node;
      startOff = startIndex - offset;
    }
    if (endIndex <= offset + len) {
      endNode = node;
      endOff = endIndex - offset;
      break;
    }
    offset += len;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  return range;
}

export function replacePlainTextInEditor(root, startIndex, deleteCount, insertText) {
  if (!root) return false;
  const range = getRangeAtPlainOffset(root, startIndex, deleteCount);
  if (!range) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(insertText));
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

export function insertPlainTextInEditor(root, text) {
  if (!root) return;
  root.focus();
  const value = String(text || '');
  if (!value) return;
  try {
    document.execCommand('insertText', false, value);
  } catch {
    root.innerHTML = sanitizeComposeHtml((root.innerHTML || '') + normalizePlainToHtml(value));
  }
}

export function setEditorHtml(root, html) {
  if (!root) return;
  const next = sanitizeComposeHtml(normalizePlainToHtml(html));
  if (root.innerHTML !== next) {
    root.innerHTML = next || '';
  }
}

export function readEditorHtml(root) {
  return sanitizeComposeHtml(root?.innerHTML || '');
}
