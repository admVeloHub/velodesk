/**
 * Client DB localStorage
 * VERSION: v1.1.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { getDeskDisplayName } from '../utils/userDisplayName';
export function getClientDB() {
  try {
    return JSON.parse(localStorage.getItem('velodeskClientDB') || '{}');
  } catch {
    return {};
  }
}

export function saveClientDB(db) {
  localStorage.setItem('velodeskClientDB', JSON.stringify(db));
}

export function lookupClient(cpfRaw) {
  const digits = String(cpfRaw || '').replace(/\D/g, '');
  if (!digits) return null;
  return getClientDB()[digits] || null;
}

export function searchClients(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const db = getClientDB();
  return Object.keys(db)
    .map((k) => db[k])
    .filter((c) => {
      const hay = [c.name, c.cpf, c.email, c.telefone].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0 || String(c.cpf || '').replace(/\D/g, '').indexOf(q.replace(/\D/g, '')) >= 0;
    });
}

export function resetClientDB() {
  const db = {};
  saveClientDB(db);
  return db;
}

export function getAgentName() {
  try {
    const user = JSON.parse(localStorage.getItem('velodesk_user') || '{}');
    return getDeskDisplayName(user) || '';
  } catch {
    return '';
  }
}
