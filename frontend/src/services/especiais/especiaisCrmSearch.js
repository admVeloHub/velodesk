/**
 * especiaisCrmSearch — busca rápida CRM órgãos (local + API dual)
 * VERSION: v1.1.0 | DATE: 2026-08-18
 * — API search em chamados_reclamacoes + chamados_n1
 */
import { reclamacoesApi } from '../../api/client';

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function collectSearchValues(item, protocolField) {
  return [
    item.chamadoProtocolo,
    item[protocolField],
    item.ticketId,
    item.id,
    item.cpf,
  ]
    .filter(Boolean)
    .map((value) => String(value));
}

export function matchesTicketCpfSearch(item, query, protocolField = 'protocoloRa') {
  const trimmed = String(query || '').trim();
  if (!trimmed) return true;

  const qLower = trimmed.toLowerCase();
  const qDigits = normalizeDigits(trimmed);
  const values = collectSearchValues(item, protocolField);

  if (values.some((value) => value.toLowerCase().includes(qLower))) {
    return true;
  }

  const cpfDigits = normalizeDigits(item.cpf);
  return qDigits.length >= 3 && cpfDigits.includes(qDigits);
}

/**
 * Busca server-side nos dois bancos (reclamacoes + n1) para o órgão.
 * @param {'reclame-aqui'|'procon'|'bacen'|'consumidor-gov'} orgaoRoute
 * @param {string} query
 * @returns {Promise<object[]>}
 */
export async function searchEspeciaisFromApi(orgaoRoute, query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const data = await reclamacoesApi.search(orgaoRoute, q, { limit: 100 });
  return Array.isArray(data?.items) ? data.items : [];
}
