/**
 * telephonyIaAdapter — adapta ligações Contact Tel / Letícia IA para classificação de motivos.
 */
import type { ITelephonyCall } from '../models/TelephonyCall';
import type { TicketIaSourceQuality } from './ticketIaAdapter.service';

export const TELEPHONY_IA_CANAL = 'leticia-ia';

export interface TelephonyIaPayload {
  telephonyCallId: string;
  externalCallId: string;
  canal: string;
  encerradaEm: string;
  titulo: string;
  resumoLigacao: string;
  qualidadeFonte: TicketIaSourceQuality;
}

function normalizeText(raw: string): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texto analisável: resumo da ligação (preferencial) ou transcrição como fallback. */
export function buildTelephonyIaText(call: ITelephonyCall, maxChars = 4000): string {
  const summary = normalizeText(call.summary ?? '');
  const transcript = normalizeText(call.transcript ?? '');
  const body = summary || transcript;
  if (!body) return '';

  const clientLabel = normalizeText(call.clientName ?? '') || call.clientPhone || 'Cliente';
  const text = [
    `Canal: Letícia IA (ligação telefônica)`,
    `Cliente: ${clientLabel}`,
    summary ? `Resumo da ligação:\n${summary}` : `Transcrição:\n${transcript}`,
  ].join('\n\n');

  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export function isElegivelTelephonyIaAnalise(call: ITelephonyCall): boolean {
  return buildTelephonyIaText(call).length > 0;
}

export function adaptTelephonyCallToIa(call: ITelephonyCall): TelephonyIaPayload | null {
  const resumoLigacao = buildTelephonyIaText(call);
  if (!resumoLigacao) return null;

  const clientLabel = normalizeText(call.clientName ?? '') || call.clientPhone || 'Cliente';
  const endedAt = call.endedAt ?? call.createdAt ?? new Date();

  return {
    telephonyCallId: String(call._id),
    externalCallId: call.externalCallId ?? '',
    canal: TELEPHONY_IA_CANAL,
    encerradaEm: new Date(endedAt).toISOString(),
    titulo: `Ligação Letícia IA — ${clientLabel}`,
    resumoLigacao,
    qualidadeFonte: normalizeText(call.summary ?? '') ? 'resumo_atendente' : 'direto_cliente',
  };
}
