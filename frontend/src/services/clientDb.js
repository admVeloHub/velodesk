/**
 * Client DB localStorage
 * VERSION: v1.2.0 | DATE: 2026-08-21
 * — upsert a partir do doc b2c_cadastros (painel; sem mutar ticket)
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

/** Grava contato do cadastro no DB local para o painel superior (não altera chamado). */
export function upsertClientFromContact(contact) {
  if (!contact) return null;
  const digits = String(contact.clientCPF || contact.cpf || '').replace(/\D/g, '');
  if (!digits) return null;
  const db = getClientDB();
  const prev = db[digits] || {};
  const next = {
    ...prev,
    cpf: digits,
    name: contact.clientName || contact.name || prev.name || '',
    email: contact.email || contact.replyEmail || contact.emails?.[0] || prev.email || '',
    telefone: contact.phone || contact.whatsappPhone || contact.phones?.[0] || prev.telefone || '',
    emails: contact.emails || prev.emails,
    phones: contact.phones || prev.phones,
    replyEmail: contact.replyEmail || prev.replyEmail,
    whatsappPhone: contact.whatsappPhone || prev.whatsappPhone,
    clienteId: contact.clienteId || prev.clienteId,
  };
  db[digits] = next;
  saveClientDB(db);
  return next;
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
    const colaborador = JSON.parse(localStorage.getItem('velodesk_colaborador') || '{}');
    return getDeskDisplayName(user, colaborador) || '';
  } catch {
    return '';
  }
}
