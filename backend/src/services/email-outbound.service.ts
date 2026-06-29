/** email-outbound.service v1.0.0 — stub Fase 1b */
import { env } from '../config/env';

export interface OutboundEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendOutboundEmail(_payload: OutboundEmailPayload): Promise<{ sent: boolean; reason?: string }> {
  if (!env.emailApiKey || !env.emailFrom) {
    return { sent: false, reason: 'EMAIL_API_KEY ou EMAIL_FROM não configurados' };
  }
  return { sent: false, reason: 'Envio outbound ainda não implementado' };
}

export function buildProtocolSubject(protocolo: string, titulo: string): string {
  return `[${protocolo}] ${titulo}`.trim();
}
