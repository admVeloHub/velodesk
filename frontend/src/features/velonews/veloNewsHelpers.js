/**
 * veloNewsHelpers v1.0.0 — ordenação e contagens VeloNews
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export function sortVeloNewsDesc(items = []) {
  return [...items].sort((a, b) => {
    const da = new Date(a.createdAt || a.updatedAt || 0).getTime() || 0;
    const db = new Date(b.createdAt || b.updatedAt || 0).getTime() || 0;
    return db - da;
  });
}

export function computeUnreadCount(items = [], acknowledgedIds = []) {
  const ackSet = new Set(acknowledgedIds.map(String));
  return items.filter((item) => !ackSet.has(String(item._id))).length;
}

export function findPendingCritical(items = [], acknowledgedIds = []) {
  const ackSet = new Set(acknowledgedIds.map(String));
  const critical = sortVeloNewsDesc(items).filter(
    (item) => item.is_critical === 'Y' && !ackSet.has(String(item._id))
  );
  return critical[0] || null;
}

export function isNewsAcknowledged(newsId, acknowledgedIds = []) {
  const id = String(newsId);
  return acknowledgedIds.some((ackId) => String(ackId) === id);
}

export function formatVeloNewsTime(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfPublished = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfPublished.getTime()) / (1000 * 60 * 60 * 24)
  );
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Hoje · ${timeStr}`;
  if (diffDays === 1) return `Ontem · ${timeStr}`;
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${dateStr} · ${timeStr}`;
}
