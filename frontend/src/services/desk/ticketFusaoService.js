/**
 * Client HTTP + orquestração da mesclagem de tickets
 * VERSION: v1.1.1 | DATE: 2026-08-04
 * — após mesclagem: só reload das boxes (não chama updateTicketInCache/API update)
 */
import { ticketFusaoApi } from '../../api/client';
import { isApiMode, loadBoxesFromApi } from '../ticketsCache';

export async function fundirTickets({ activeId, inactiveIds, cpf }) {
  const data = await ticketFusaoApi.fundir({ activeId, inactiveIds, cpf });
  if (isApiMode()) {
    await loadBoxesFromApi();
  }
  return data;
}
