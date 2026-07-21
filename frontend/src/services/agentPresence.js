/**
 * agentPresence v1.0.0 — heartbeat ~2min + offline no logout
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */
import api from '../api/client';

const HEARTBEAT_MS = 120_000;
let heartbeatTimer = null;
let started = false;

export async function sendAgentHeartbeat() {
  try {
    await api.post('/agents/presence/heartbeat');
  } catch (err) {
    console.warn('[agentPresence] heartbeat falhou', err?.response?.status || err?.message);
  }
}

export async function sendAgentOffline() {
  try {
    await api.post('/agents/presence/offline');
  } catch {
    /* best-effort */
  }
}

function onBeforeUnload() {
  const token = localStorage.getItem('velodesk_token');
  if (!token) return;
  try {
    navigator.sendBeacon('/api/agents/presence/offline', new Blob([], { type: 'application/json' }));
  } catch {
    /* noop */
  }
}

export function startAgentPresenceHeartbeat() {
  if (started) return;
  started = true;

  void sendAgentHeartbeat();

  heartbeatTimer = window.setInterval(() => {
    void sendAgentHeartbeat();
  }, HEARTBEAT_MS);

  window.addEventListener('beforeunload', onBeforeUnload);
}

export function stopAgentPresenceHeartbeat() {
  if (!started) return;
  started = false;

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  window.removeEventListener('beforeunload', onBeforeUnload);
}

export async function notifyAgentOfflineAndStop() {
  stopAgentPresenceHeartbeat();
  await sendAgentOffline();
}
