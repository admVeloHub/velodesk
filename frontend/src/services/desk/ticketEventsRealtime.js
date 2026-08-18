/**
 * ticketEventsRealtime v1.0.0 — assina "pings" de mudança de ticket (Supabase Realtime broadcast).
 *
 * Estritamente aditivo: quando um evento chega para o ticket aberto, o Desk antecipa um refresh
 * leve (view=light). O polling por timer segue como fallback confiável, então se o Realtime não
 * estiver configurado (VITE_PRESENCE_SUPABASE_URL/ANON_KEY ausentes) nada muda.
 *
 * Canal broadcast PÚBLICO — o payload traz só { ticketId, type } (sem conteúdo), evitando
 * dependência de políticas RLS específicas do projeto Supabase.
 */
import { createClient } from '@supabase/supabase-js';

const CHANNEL_TOPIC = 'ticket-events';

const SUPABASE_URL = String(import.meta.env.VITE_PRESENCE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_PRESENCE_SUPABASE_ANON_KEY || '').trim();

let supabaseClient = null;
let channel = null;
let refCount = 0;
const listeners = new Set();

export function isTicketEventsConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function notify(payload) {
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.warn('[ticketEventsRealtime] listener falhou', err);
    }
  });
}

function ensureChannel() {
  if (channel || !isTicketEventsConfigured()) return;
  channel = getClient().channel(CHANNEL_TOPIC, { config: { broadcast: { self: false } } });
  channel.on('broadcast', { event: 'ticket' }, (message) => {
    const payload = message?.payload;
    if (payload && payload.ticketId) notify(payload);
  });
  channel.subscribe();
}

/**
 * Inscreve um callback para eventos de ticket. Retorna uma função de cleanup.
 * `callback({ ticketId, type, at })`.
 */
export function subscribeToTicketEvents(callback) {
  if (!isTicketEventsConfigured()) return () => {};
  listeners.add(callback);
  refCount += 1;
  ensureChannel();
  return () => {
    listeners.delete(callback);
    refCount -= 1;
    if (refCount <= 0 && channel) {
      channel.unsubscribe();
      channel = null;
      refCount = 0;
    }
  };
}
