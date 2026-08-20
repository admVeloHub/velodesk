/**
 * composeRichEditor v1.0.4 — sanitize HTML sem crash em e-mail aninhado
 * VERSION: v1.0.4 | DATE: 2026-08-20
 */

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'IMG']);

export const COMPOSE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export function isAllowedComposeImageSrc(src) {
  const value = String(src || '').trim();
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)
    || /^https:\/\/.+/i.test(value);
}

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

/** Texto plano normalizado para comparar compose vs revisão IA (html ou plain). */
export function normalizeComposePlain(value) {
  const raw = String(value ?? '');
  const plain = /<[a-z][\s\S]*>/i.test(raw) ? htmlToPlainText(raw) : raw;
  return plain.replace(/\r\n/g, '\n').replace(/\u00A0/g, ' ').trim();
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
  try {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');

    const walk = (node, depth = 0) => {
      if (!node || depth > 48) return;
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const el = child;
          if (el.tagName === 'IMG') {
            const src = el.getAttribute('src') || '';
            if (!isAllowedComposeImageSrc(src)) {
              el.remove();
              return;
            }
            const alt = String(el.getAttribute('alt') || 'Imagem anexada').slice(0, 200);
            [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
            el.setAttribute('src', src);
            el.setAttribute('alt', alt);
            el.className = 'compose-inline-image';
            return;
          }
          if (!ALLOWED_TAGS.has(el.tagName)) {
            const parent = el.parentNode;
            if (parent) {
              while (el.firstChild) parent.insertBefore(el.firstChild, el);
            }
            el.remove();
            return;
          }
          [...el.attributes].forEach((attr) => el.removeAttribute(attr.name));
          walk(el, depth + 1);
          return;
        }
        if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
        }
      });
    };

    walk(template.content);
    return template.innerHTML.replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '<br />');
  } catch (err) {
    console.warn('[composeRichEditor] sanitizeComposeHtml falhou', err);
    return '';
  }
}

/** Serializa nós DOM — DocumentFragment não expõe innerHTML. */
function domNodesToHtml(root) {
  if (!root) return '';
  const wrapper = document.createElement('div');
  while (root.firstChild) {
    wrapper.appendChild(root.firstChild);
  }
  return wrapper.innerHTML;
}

/** Normaliza HTML salvo pelo editor para exibição fiel na thread (listas + parágrafos após lista). */
export function normalizeMessageHtmlForDisplay(html) {
  try {
  const raw = String(html ?? '').trim();
  if (!raw) return '';

  const safe = sanitizeComposeHtml(raw);
  if (!safe) return '';

  const template = document.createElement('template');
  template.innerHTML = safe;

  const root = template.content;
  const blockAfterList = (list) => {
    let next = list.nextSibling;
    while (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'BR') {
      const toRemove = next;
      next = next.nextSibling;
      toRemove.remove();
    }
    if (!next) return;

    if (next.nodeType === Node.TEXT_NODE && String(next.textContent || '').trim()) {
      const p = document.createElement('p');
      p.textContent = next.textContent;
      next.replaceWith(p);
      return;
    }

    if (next.nodeType !== Node.ELEMENT_NODE) return;
    const el = next;
    if (el.tagName === 'DIV' && !el.querySelector('ol, ul, img')) {
      const p = document.createElement('p');
      p.innerHTML = el.innerHTML;
      el.replaceWith(p);
    }
  };

  root.querySelectorAll('ol, ul').forEach(blockAfterList);

  root.querySelectorAll('li').forEach((li) => {
    li.querySelectorAll('div').forEach((div) => {
      if (div.querySelector('ol, ul, img')) return;
      const br = document.createElement('br');
      while (div.firstChild) {
        br.before(div.firstChild);
      }
      div.replaceWith(br);
    });
  });

  return domNodesToHtml(root).replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, '<br />');
  } catch (err) {
    console.warn('[composeRichEditor] normalizeMessageHtmlForDisplay falhou', err);
    return '';
  }
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

export function insertImageInEditor(root, src, alt = 'Imagem anexada') {
  if (!root || !isAllowedComposeImageSrc(src)) return false;

  root.focus();
  const img = document.createElement('img');
  img.src = src;
  img.alt = String(alt || 'Imagem anexada').slice(0, 200);
  img.className = 'compose-inline-image';

  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    }
  }

  if (root.lastChild && root.lastChild.nodeName !== 'BR') {
    root.appendChild(document.createElement('br'));
  }
  root.appendChild(img);
  return true;
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
