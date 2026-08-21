/**
 * attachmentGuard.util v1.1.0 — skipAntivirusScan p/ anexos outbound do agente
 * VERSION: v1.1.0 | DATE: 2026-08-21
 */

export type AttachmentKind = 'image' | 'audio' | 'video' | 'pdf' | 'office' | 'zip';
export type AttachmentScanStatus = 'skipped' | 'pending' | 'clean' | 'infected' | 'unscannable';

export const TYPE_SIZE_LIMITS: Record<AttachmentKind, number> = {
  image: 12 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  office: 15 * 1024 * 1024,
  zip: 10 * 1024 * 1024,
};

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'scr', 'bat', 'cmd', 'com', 'cpl', 'msi', 'msp', 'dll', 'sys',
  'ps1', 'psm1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'hta', 'lnk',
  'jar', 'iso', 'img', 'html', 'htm', 'xhtml', 'svg', 'shtml',
]);

const DANGEROUS_TAIL = [...BLOCKED_EXTENSIONS].join('|');
const DOUBLE_EXTENSION_RE = new RegExp(`\\.[a-z0-9]{1,8}\\.(${DANGEROUS_TAIL})$`, 'i');

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
const AUDIO_EXT = new Set(['ogg', 'opus', 'mp3', 'm4a', 'aac', 'amr', 'wav']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov']);
const PDF_EXT = new Set(['pdf']);
const OFFICE_EXT = new Set([
  'doc', 'docx', 'docm', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'pptm',
  'odt', 'ods', 'odp',
]);
const ZIP_EXT = new Set(['zip']);

export interface AttachmentGuardOk {
  ok: true;
  kind: AttachmentKind;
  needsScan: boolean;
  detectedMime: string;
  scanStatus: 'skipped' | 'pending';
}

export interface AttachmentGuardReject {
  ok: false;
  reason: string;
  code: 'empty' | 'blocked_type' | 'double_extension' | 'oversize' | 'password_zip' | 'magic_mismatch';
}

export type AttachmentGuardResult = AttachmentGuardOk | AttachmentGuardReject;

/** Anexos do agente (outbound): validação estática sem fila ClamAV. */
export interface AttachmentGuardOptions {
  skipAntivirusScan?: boolean;
}

function fileExtension(filename: string): string {
  const base = String(filename || '').trim().split(/[/\\]/).pop() || '';
  const match = /\.([a-z0-9]{1,8})$/i.exec(base);
  return match?.[1]?.toLowerCase() || '';
}

function kindFromExtension(ext: string): AttachmentKind | null {
  if (IMAGE_EXT.has(ext)) return 'image';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (PDF_EXT.has(ext)) return 'pdf';
  if (OFFICE_EXT.has(ext)) return 'office';
  if (ZIP_EXT.has(ext)) return 'zip';
  return null;
}

function kindFromDeclaredMime(contentType: string): AttachmentKind | null {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!type || type === 'application/octet-stream') return null;
  if (type === 'image/svg+xml' || type === 'text/html' || type === 'application/xhtml+xml') return null;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  if (type === 'application/pdf') return 'pdf';
  if (
    type === 'application/zip'
    || type === 'application/x-zip-compressed'
  ) return 'zip';
  if (
    type.includes('msword')
    || type.includes('officedocument')
    || type.includes('ms-excel')
    || type.includes('ms-powerpoint')
    || type.includes('opendocument')
    || type.includes('macroenabled')
  ) return 'office';
  return null;
}

function detectMagic(buffer: Buffer): { kind: AttachmentKind | 'html' | 'svg' | 'exe' | null; mime: string } {
  if (buffer.length < 4) return { kind: null, mime: '' };

  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { kind: 'image', mime: 'image/jpeg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { kind: 'image', mime: 'image/png' };
  }
  if (buffer.toString('ascii', 0, 3) === 'GIF') return { kind: 'image', mime: 'image/gif' };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { kind: 'image', mime: 'image/webp' };
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return { kind: 'image', mime: 'image/bmp' };
  if (buffer.toString('ascii', 0, 4) === '%PDF') return { kind: 'pdf', mime: 'application/pdf' };
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) {
    return { kind: 'zip', mime: 'application/zip' };
  }
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return { kind: 'office', mime: 'application/msword' };
  }
  if (buffer.toString('ascii', 0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg' };
  if (buffer.toString('ascii', 0, 3) === 'ID3') return { kind: 'audio', mime: 'audio/mpeg' };
  if (buffer.length > 2 && buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2)) {
    return { kind: 'audio', mime: 'audio/mpeg' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return { kind: 'audio', mime: 'audio/wav' };
  }
  if (buffer.length > 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand.startsWith('M4A') || brand.startsWith('mp4a')) return { kind: 'audio', mime: 'audio/mp4' };
    return { kind: 'video', mime: 'video/mp4' };
  }
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return { kind: 'video', mime: 'video/webm' };
  }
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) return { kind: 'exe', mime: 'application/x-msdownload' };

  const head = buffer.toString('utf8', 0, Math.min(256, buffer.length)).trim().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return { kind: 'svg', mime: 'image/svg+xml' };
  }
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return { kind: 'html', mime: 'text/html' };
  }
  return { kind: null, mime: '' };
}

function isPasswordProtectedZip(buffer: Buffer): boolean {
  let offset = 0;
  let sawLocalHeader = false;
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      if (!sawLocalHeader) return false;
      const next = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), offset + 1);
      if (next < 0) break;
      offset = next;
      continue;
    }
    sawLocalHeader = true;
    const flags = buffer.readUInt16LE(offset + 6);
    if (flags & 0x0001) return true;
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    if (flags & 0x0008) {
      offset += 30 + nameLen + extraLen;
      continue;
    }
    offset += 30 + nameLen + extraLen + compressed;
  }
  return false;
}

function resolveKind(
  magicKind: ReturnType<typeof detectMagic>['kind'],
  declaredKind: AttachmentKind | null,
  extKind: AttachmentKind | null,
): AttachmentKind | 'html' | 'svg' | 'exe' | null {
  if (magicKind === 'html' || magicKind === 'svg' || magicKind === 'exe') return magicKind;
  if (magicKind === 'zip' && (extKind === 'office' || declaredKind === 'office')) return 'office';
  if (magicKind === 'zip' && (extKind === 'zip' || declaredKind === 'zip' || !extKind)) return 'zip';
  if (magicKind) return magicKind;
  return declaredKind || extKind;
}

export function inspectAttachmentGuard(
  filename: string,
  contentType: string,
  buffer: Buffer,
  options: AttachmentGuardOptions = {},
): AttachmentGuardResult {
  if (!buffer?.length) {
    return { ok: false, code: 'empty', reason: 'Arquivo vazio.' };
  }

  const name = String(filename || 'anexo').trim() || 'anexo';
  if (DOUBLE_EXTENSION_RE.test(name)) {
    return { ok: false, code: 'double_extension', reason: `Extensão dupla bloqueada: ${name}` };
  }

  const ext = fileExtension(name);
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, code: 'blocked_type', reason: `Tipo de arquivo bloqueado: .${ext}` };
  }

  const magic = detectMagic(buffer);
  if (magic.kind === 'exe' || magic.kind === 'html' || magic.kind === 'svg') {
    return { ok: false, code: 'blocked_type', reason: `Conteúdo bloqueado (${magic.kind}).` };
  }

  const declaredKind = kindFromDeclaredMime(contentType);
  const extKind = kindFromExtension(ext);
  const kind = resolveKind(magic.kind, declaredKind, extKind);

  if (!kind || kind === 'html' || kind === 'svg' || kind === 'exe') {
    return { ok: false, code: 'blocked_type', reason: 'Tipo de arquivo não permitido.' };
  }

  if (magic.kind && declaredKind && magic.kind !== 'zip' && declaredKind !== kind && magic.kind !== declaredKind) {
    return {
      ok: false,
      code: 'magic_mismatch',
      reason: `Conteúdo (${magic.kind}) não confere com o tipo declarado (${declaredKind}).`,
    };
  }

  if ((kind === 'zip' || (kind === 'office' && magic.kind === 'zip')) && isPasswordProtectedZip(buffer)) {
    return { ok: false, code: 'password_zip', reason: 'Arquivo compactado com senha não é aceito.' };
  }

  const limit = TYPE_SIZE_LIMITS[kind];
  if (buffer.length > limit) {
    return {
      ok: false,
      code: 'oversize',
      reason: `Arquivo excede o limite de ${Math.round(limit / (1024 * 1024))}MB para ${kind}.`,
    };
  }

  const needsScan = !options.skipAntivirusScan && (kind === 'pdf' || kind === 'office' || kind === 'zip');
  return {
    ok: true,
    kind,
    needsScan,
    detectedMime: magic.mime || String(contentType || '').split(';')[0].trim() || 'application/octet-stream',
    scanStatus: needsScan ? 'pending' : 'skipped',
  };
}

export function isSafeMediaKind(kind: AttachmentKind): boolean {
  return kind === 'image' || kind === 'audio' || kind === 'video';
}
