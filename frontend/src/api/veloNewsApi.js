/**
 * veloNewsApi v1.0.5 — VeloNews via API VeloHub (VeloHubCentral / console_conteudo)
 * VERSION: v1.0.5 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 *
 * Endpoints /velo-news/* → proxy /velohub-api → API VeloHub
 * Persistência: console_conteudo.Velonews + velonews_acknowledgments (VeloHubCentral)
 */
import { requireVelohubApiBaseUrl, VELOHUB_API_PROXY_PREFIX } from '../config/velohubApiConfig';

function assertVelohubProxyBase(base) {
  if (base !== VELOHUB_API_PROXY_PREFIX || String(base).startsWith('/api')) {
    throw new Error(
      'VeloNews deve usar exclusivamente o proxy VeloHub (/velohub-api), não /api do VeloDesk.',
    );
  }
}

async function veloNewsRequest(path, options = {}) {
  const base = requireVelohubApiBaseUrl();
  assertVelohubProxyBase(base);
  const res = await fetch(`${base}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `VeloNews API ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

function normalizeNewsItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    _id: String(item._id),
    title: item.title || '(sem título)',
    content: item.content || '',
    is_critical: item.is_critical === 'Y' ? 'Y' : 'N',
    solved: item.solved === true,
    media: item.media || { images: [], videos: [] },
    thread: Array.isArray(item.thread) ? item.thread : [],
  };
}

export async function fetchVeloNews(limit) {
  const qs = typeof limit === 'number' && limit > 0 ? `?limit=${limit}` : '';
  const data = await veloNewsRequest(`/velo-news${qs}`);
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.map(normalizeNewsItem).filter(Boolean);
}

export async function fetchAllVeloNews() {
  return fetchVeloNews();
}

export async function fetchAcknowledgments(userEmail) {
  if (!userEmail) return [];
  const data = await veloNewsRequest(
    `/velo-news/acknowledgments/${encodeURIComponent(userEmail)}`
  );
  return Array.isArray(data?.acknowledgedNewsIds)
    ? data.acknowledgedNewsIds.map(String)
    : [];
}

export async function acknowledgeNews(newsId, userEmail, userName) {
  return veloNewsRequest(`/velo-news/${encodeURIComponent(newsId)}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({
      userId: userEmail,
      userName: userName || 'Usuário',
    }),
  });
}

export async function addVeloNewsComment(newsId, userName, comentario) {
  return veloNewsRequest(`/velo-news/${encodeURIComponent(newsId)}/comment`, {
    method: 'PUT',
    body: JSON.stringify({ userName, comentario }),
  });
}
