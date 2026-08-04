/**
 * Client HTTP da Busca de Tickets
 * VERSION: v1.0.1 | DATE: 2026-08-04
 */
import { ticketSearchApi } from '../../api/client';

/**
 * @param {{ criterios: Array, limit?: number }} params
 * @returns {Promise<{ success: boolean, tickets: Array, total: number, limit: number, message?: string }>}
 */
export async function searchTicketsApi({ criterios, limit = 100 } = {}) {
  return ticketSearchApi.search({ criterios, limit });
}
