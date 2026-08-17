/**
 * ticketPresenceRealtime v1.1.0 — 503 (não configurado) não reintenta em loop
 * Indica, por ticket, quem está com foco (verde) e quem só tem aberto em aba adicional (amarelo).
 * VERSION: v1.1.0 | DATE: 2026-08-17
 */
import { createClient } from '@supabase/supabase-js';
import api from '../../api/client';

const PRESENCE_CHANNEL_TOPIC = 'presence:desk';
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const TOKEN_RETRY_BASE_MS = 15_000;
const TOKEN_RETRY_MAX_MS = 5 * 60_000;

const SUPABASE_URL = String(import.meta.env.VITE_PRESENCE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_PRESENCE_SUPABASE_ANON_KEY || '').trim();

let supabaseClient = null;
let channel = null;
let tokenRefreshTimer = null;
let listeners = new Set();
let myKey = '';
let myMeta = { name: '' };
let lastTrackedPayload = null;
let presenceUnavailable = false;
let refreshGeneration = 0;

export function isTicketPresenceConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function notifyListeners(presenceState) {
  listeners.forEach((cb) => {
    try {
      cb(presenceState);
    } catch (err) {
      console.warn('[ticketPresenceRealtime] listener falhou', err);
    }
  });
}

function readPresenceState() {
  if (!channel) return {};
  const raw = channel.presenceState();
  const byKey = {};
  Object.keys(raw).forEach((key) => {
    if (key === myKey) return;
    const entries = raw[key];
    const latest = entries?.[entries.length - 1];
    if (latest) byKey[key] = latest;
  });
  return byKey;
}

async function fetchPresenceToken() {
  const { data } = await api.get('/agents/presence/realtime-token');
  return data;
}

async function refreshAuthAndScheduleNext(attempt = 0) {
  if (presenceUnavailable) return false;
  const generation = ++refreshGeneration;
  try {
    const { token, expiresAt } = await fetchPresenceToken();
    if (generation !== refreshGeneration) return false;
    getSupabaseClient().realtime.setAuth(token);

    const expiresInMs = new Date(expiresAt).getTime() - Date.now();
    const nextInMs = Math.max(expiresInMs - TOKEN_REFRESH_MARGIN_MS, TOKEN_REFRESH_MARGIN_MS);
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = setTimeout(() => { void refreshAuthAndScheduleNext(0); }, nextInMs);
    return true;
  } catch (err) {
    if (generation !== refreshGeneration) return false;
    const status = err?.response?.status;
    console.warn('[ticketPresenceRealtime] falha ao obter token de presence', status || err?.message);
    clearTimeout(tokenRefreshTimer);
    if (status === 503) {
      presenceUnavailable = true;
      return false;
    }
    const delay = Math.min(TOKEN_RETRY_BASE_MS * (2 ** attempt), TOKEN_RETRY_MAX_MS);
    tokenRefreshTimer = setTimeout(() => { void refreshAuthAndScheduleNext(attempt + 1); }, delay);
    return false;
  }
}

async function trackCurrentPayload() {
  if (!channel || !lastTrackedPayload) return;
  try {
    await channel.track(lastTrackedPayload);
  } catch (err) {
    console.warn('[ticketPresenceRealtime] track falhou', err?.message);
  }
}

export async function startTicketPresence({ userKey, name }) {
  if (!isTicketPresenceConfigured() || channel) return;

  myKey = String(userKey || '').trim().toLowerCase();
  myMeta = { name: name || myKey };
  if (!myKey) return;

  const ok = await refreshAuthAndScheduleNext();
  if (!ok) return;

  const supabase = getSupabaseClient();
  channel = supabase.channel(PRESENCE_CHANNEL_TOPIC, {
    config: { private: true, presence: { key: myKey } },
  });

  channel.on('presence', { event: 'sync' }, () => notifyListeners(readPresenceState()));
  channel.on('presence', { event: 'join' }, () => notifyListeners(readPresenceState()));
  channel.on('presence', { event: 'leave' }, () => notifyListeners(readPresenceState()));

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await trackCurrentPayload();
    }
  });
}

export function stopTicketPresence() {
  refreshGeneration += 1;
  clearTimeout(tokenRefreshTimer);
  tokenRefreshTimer = null;
  if (channel) {
    channel.unsubscribe();
    channel = null;
  }
  lastTrackedPayload = null;
  myKey = '';
  listeners.forEach((cb) => {
    try {
      cb({});
    } catch {
      /* noop */
    }
  });
}

export function updateMyTicketPresence({ activeTicketId, openTicketIds }) {
  lastTrackedPayload = {
    ...myMeta,
    activeTicketId: activeTicketId ? String(activeTicketId) : '',
    openTicketIds: (openTicketIds || []).map(String),
  };
  void trackCurrentPayload();
}

export function subscribeToTicketPresence(callback) {
  listeners.add(callback);
  callback(readPresenceState());
  return () => listeners.delete(callback);
}
