/**
 * persistedTicketId v1.0.0 — evita CastError em IDs locais draft-*
 * VERSION: v1.0.0 | DATE: 2026-08-20
 */
import mongoose from 'mongoose';

export function isDraftTicketId(ticketId?: string | null): boolean {
  return String(ticketId ?? '').trim().startsWith('draft-');
}

/** ID persistido no Mongo (24 hex) — exclui rascunhos locais do Desk. */
export function isPersistedMongoTicketId(ticketId?: string | null): boolean {
  const id = String(ticketId ?? '').trim();
  if (!id || isDraftTicketId(id)) return false;
  return mongoose.Types.ObjectId.isValid(id);
}
