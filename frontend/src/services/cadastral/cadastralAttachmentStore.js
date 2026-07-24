/**
 * cadastralAttachmentStore v1.0.0 — blobs de anexos Erros/Bugs (IndexedDB)
 * VERSION: v1.0.0 | DATE: 2026-07-23
 */

const DB_NAME = 'velodesk_cadastral_attachments';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

export const ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENT_IMAGES = 5;
export const MAX_ATTACHMENT_VIDEOS = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB.'));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha na operação IndexedDB.'));
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await callback(store);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Falha na transação IndexedDB.'));
    });
    return result;
  } finally {
    db.close();
  }
}

export function validateAttachmentFile(file, { isVideo = false } = {}) {
  if (!file) return 'Arquivo inválido.';
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return `Arquivo muito grande (máx. ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB).`;
  }
  if (isVideo) {
    if (!String(file.type || '').startsWith('video/')) return 'Selecione um arquivo de vídeo.';
    return null;
  }
  if (!String(file.type || '').startsWith('image/')) return 'Selecione um arquivo de imagem.';
  return null;
}

export async function saveAttachment(file, id = null) {
  const attachmentId = id || `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id: attachmentId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    blob: file,
    savedAt: new Date().toISOString(),
  };

  await withStore('readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });

  return {
    id: attachmentId,
    name: record.name,
    size: record.size,
    mimeType: record.mimeType,
  };
}

export async function getAttachmentBlob(id) {
  const key = String(id || '').trim();
  if (!key) return null;

  const record = await withStore('readonly', async (store) => requestToPromise(store.get(key)));
  return record?.blob || null;
}

export async function getAttachmentObjectUrl(id) {
  const blob = await getAttachmentBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deleteAttachment(id) {
  const key = String(id || '').trim();
  if (!key) return;
  await withStore('readwrite', async (store) => {
    await requestToPromise(store.delete(key));
  });
}

export async function deleteAttachments(ids = []) {
  const unique = [...new Set(ids.map((item) => String(item || '').trim()).filter(Boolean))];
  if (!unique.length) return;
  await withStore('readwrite', async (store) => {
    await Promise.all(unique.map((id) => requestToPromise(store.delete(id))));
  });
}

/**
 * Persiste entries do formulário (com `file`) e retorna refs para localStorage/ticket.
 */
export async function persistAttachmentEntries(imagens = [], videos = []) {
  if (imagens.length > MAX_ATTACHMENT_IMAGES) {
    throw new Error(`Máximo de ${MAX_ATTACHMENT_IMAGES} imagens por solicitação.`);
  }
  if (videos.length > MAX_ATTACHMENT_VIDEOS) {
    throw new Error(`Máximo de ${MAX_ATTACHMENT_VIDEOS} vídeos por solicitação.`);
  }

  const anexosImagens = [];
  for (const entry of imagens) {
    const file = entry.file;
    if (!file) {
      if (entry.id) {
        anexosImagens.push({
          id: entry.id,
          name: entry.name,
          size: entry.size,
          mimeType: entry.mimeType,
        });
      }
      continue;
    }
    const err = validateAttachmentFile(file, { isVideo: false });
    if (err) throw new Error(err);
    anexosImagens.push(await saveAttachment(file, entry.id));
  }

  const anexosVideos = [];
  for (const entry of videos) {
    const file = entry.file;
    if (!file) {
      if (entry.id) {
        anexosVideos.push({
          id: entry.id,
          name: entry.name,
          size: entry.size,
          mimeType: entry.mimeType,
        });
      }
      continue;
    }
    const err = validateAttachmentFile(file, { isVideo: true });
    if (err) throw new Error(err);
    anexosVideos.push(await saveAttachment(file, entry.id));
  }

  return { anexosImagens, anexosVideos };
}

/** Resolve URL de preview: HTTPS direto ou blob via IndexedDB */
export async function resolveAttachmentPreviewUrl(ref) {
  if (!ref) return null;
  const url = String(ref.url || ref.src || '').trim();
  if (/^https:\/\/.+/i.test(url)) return url;
  const id = String(ref.id || '').trim();
  if (!id) return null;
  return getAttachmentObjectUrl(id);
}
