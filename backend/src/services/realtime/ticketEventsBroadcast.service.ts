/**
 * ticketEventsBroadcast.service v1.0.0 — publica "ping" de mudança de ticket no Supabase Realtime.
 *
 * Estritamente aditivo e seguro: se PRESENCE_REALTIME_URL/PRESENCE_REALTIME_ANON_KEY não estiverem
 * configurados, é NO-OP e nada muda (o polling leve continua sendo o mecanismo confiável).
 * O payload carrega apenas { ticketId, type } — sem conteúdo sensível — em canal broadcast público,
 * então não depende de políticas RLS específicas do projeto Supabase.
 */
import { env } from '../../config/env';

const CHANNEL_TOPIC = 'ticket-events';
const PUBLISH_TIMEOUT_MS = 4000;

export function isTicketEventsBroadcastConfigured(): boolean {
  return Boolean(env.ticketEventsRealtimeUrl && env.ticketEventsRealtimeApiKey);
}

export type TicketEventType =
  | 'whatsapp-inbound'
  | 'whatsapp-outbound'
  | 'message'
  | 'commit'
  | 'status';

/**
 * Dispara um evento de mudança de ticket. Fire-and-forget: nunca lança nem bloqueia o fluxo do
 * chamador (o await interno é protegido). Chame com `void publishTicketEvent(...)`.
 */
export async function publishTicketEvent(ticketId: string, type: TicketEventType): Promise<void> {
  if (!isTicketEventsBroadcastConfigured()) return;
  const id = String(ticketId || '').trim();
  if (!id) return;

  const url = `${env.ticketEventsRealtimeUrl}/realtime/v1/api/broadcast`;
  const body = {
    messages: [
      {
        topic: CHANNEL_TOPIC,
        event: 'ticket',
        payload: { ticketId: id, type, at: new Date().toISOString() },
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.ticketEventsRealtimeApiKey,
        Authorization: `Bearer ${env.ticketEventsRealtimeApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    // Realtime é só um acelerador; a falha não pode afetar o atendimento.
    console.warn('[ticket-events] broadcast falhou (seguindo no polling)', (err as Error)?.message);
  } finally {
    clearTimeout(timer);
  }
}
