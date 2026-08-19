/**
 * attachmentPreview v1.2.0 — coleta de anexos do ticket para console /workflow
 * VERSION: v1.2.0 | DATE: 2026-08-19
 */

const OFFICE_MIME = new Set([
  'application/msword',
  'application/vnd.ms-word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word.document.macroenabled.12',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

export function attachmentHref(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.startsWith('/api/') ? raw : `/api${raw.startsWith('/') ? raw : `/${raw}`}`;
}

export function attachmentLabelFromUrl(url) {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) return 'Anexo';
  const withoutScheme = rawUrl.replace(/^gs:\/\//i, '').replace(/^https?:\/\/[^/]+/i, '');
  let leaf = withoutScheme.split('/').pop() || rawUrl.split('/').pop() || 'Anexo';
  try {
    leaf = decodeURIComponent(leaf);
  } catch {
    // nome com % literal
  }
  const withoutUuid = leaf.replace(/^[0-9a-f-]{36}-/i, '');
  return withoutUuid.replace(/__/g, '/').split('/').pop() || 'Anexo';
}

export function parseFilenameFromDisposition(header) {
  const raw = String(header || '');
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(raw);
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1].replace(/^"|"$/g, '').trim());
  } catch {
    return match[1].replace(/^"|"$/g, '').trim();
  }
}

function normalizeMime(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

export function classifyAttachmentKind(contentType, filename) {
  const type = normalizeMime(contentType);
  const name = String(filename || '').toLowerCase();

  if (type === 'image/svg+xml' || type === 'text/html' || type === 'application/xhtml+xml'
    || /\.(svg|html?|xhtml)$/i.test(name)) {
    return 'other';
  }

  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (OFFICE_MIME.has(type)) return 'office';

  if (/\.pdf$/i.test(name)) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return 'image';
  if (/\.(ogg|opus|mp3|m4a|aac|amr|wav)$/i.test(name)) return 'audio';
  if (/\.(mp4|webm|mov)$/i.test(name)) return 'video';
  if (/\.(docx?|xlsx?|pptx?|docm|xlsm|pptm|odt|ods|odp)$/i.test(name)) return 'office';
  return 'other';
}

export function shouldOpenPreviewModal(kind) {
  return kind === 'image' || kind === 'audio' || kind === 'video' || kind === 'pdf' || kind === 'office';
}

export function attachmentKindIcon(kind) {
  if (kind === 'image') return 'ti-photo';
  if (kind === 'audio') return 'ti-volume';
  if (kind === 'video') return 'ti-video';
  if (kind === 'pdf') return 'ti-file-type-pdf';
  if (kind === 'office') return 'ti-file-text';
  return 'ti-paperclip';
}

export async function fetchAuthenticatedAttachment(url) {
  const href = attachmentHref(url);
  const token = localStorage.getItem('velodesk_token');
  const response = await fetch(href, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = 'Não foi possível abrir o anexo.';
    try {
      const data = await response.json();
      if (data?.message) detail = data.message;
    } catch {
      detail = `Anexo indisponível (HTTP ${response.status})`;
    }
    throw new Error(detail);
  }
  return response;
}

export async function loadAttachmentForPreview(url, knownContentType = '') {
  const response = await fetchAuthenticatedAttachment(url);
  const rawBlob = await response.blob();
  const headerType = normalizeMime(response.headers.get('content-type'));
  const blobType = normalizeMime(rawBlob.type);
  const contentType = headerType || blobType || normalizeMime(knownContentType) || 'application/octet-stream';
  const dispositionName = parseFilenameFromDisposition(response.headers.get('content-disposition'));
  const filename = attachmentLabelFromUrl(dispositionName || url);
  const blob = rawBlob.type === contentType
    ? rawBlob
    : new Blob([rawBlob], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);
  const kind = classifyAttachmentKind(contentType, filename);
  return { objectUrl, filename, contentType, kind };
}

export function downloadObjectUrl(objectUrl, filename) {
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'anexo';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function isBrandInlineAttachmentUrl(url) {
  const label = attachmentLabelFromUrl(url).toLowerCase();
  return label.includes('simbolo_velotax')
    || label.includes('velodesk-brand')
    || /^logo\.(png|jpe?g|gif|webp)$/i.test(label);
}

function pushMessageAttachments(result, seen, message) {
  if (!message) return;
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const scanStatuses = Array.isArray(message.attachmentScanStatuses)
    ? message.attachmentScanStatuses
    : [];
  const contentTypes = Array.isArray(message.mediaContentTypes)
    ? message.mediaContentTypes
    : [];

  attachments.forEach((raw, index) => {
    const url = String(raw || '').trim();
    if (!url || seen.has(url) || isBrandInlineAttachmentUrl(url)) return;
    seen.add(url);
    result.push({
      url,
      label: attachmentLabelFromUrl(url),
      scanStatus: String(scanStatuses[index] || '').trim().toLowerCase(),
      contentType: String(contentTypes[index] || '').trim(),
    });
  });
}

/** Anexos únicos das mensagens públicas e notas internas do ticket. */
export function collectTicketAttachments(ticket) {
  if (!ticket) return [];

  const seen = new Set();
  const result = [];

  (ticket.messages || []).forEach((message) => pushMessageAttachments(result, seen, message));
  (ticket.internalNotes || []).forEach((note) => pushMessageAttachments(result, seen, note));

  return result;
}
