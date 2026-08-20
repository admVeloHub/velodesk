/**
 * NotificationContext v1.5.0 — bubble do sininho por 1 min em recado de ticket
 * VERSION: v1.5.0 | DATE: 2026-08-20
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { workflowNotificacoesApi } from '../api/client';
import { isRateLimitError, RATE_LIMIT_USER_MESSAGE } from '../utils/apiErrors';
import { useAuth } from './AuthContext';
import { subscribeToTicketEvents } from '../services/desk/ticketEventsRealtime';

const NotificationContext = createContext(null);
const TOAST_VISIBLE_MS = 2000;
const HYDRATE_INTERVAL_MS = 15000;
const FOOTER_PULSE_MS = 60000;
const RECENT_NOTIF_MS = 2 * 60 * 1000;

function mapPersistedNotification(row) {
  const mensagem = String(row.mensagem || '').trim();
  const titulo = String(row.titulo || '').trim();
  return {
    id: `wf-${row._id}`,
    persistId: row._id,
    message: mensagem || titulo,
    title: titulo,
    type: row.tipo === 'caso_especial'
      ? 'caso-especial-cta'
      : (row.workflowSlug === 'telephony-inbound' ? 'telephony-cta' : 'workflow-cta'),
    ticketId: row.ticketId ? String(row.ticketId) : '',
    especialOrgao: row.tipo === 'caso_especial' ? (row.orgao || '') : '',
    protocolo: row.chamadoProtocolo,
    lida: row.lida,
    createdAt: row.createdAt,
  };
}

function isRecentNotification(row) {
  const created = new Date(row.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created < RECENT_NOTIF_MS;
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadPersisted, setUnreadPersisted] = useState(0);
  const [pulseBadgeCount, setPulseBadgeCount] = useState(0);
  const seenIdsRef = useRef(new Set());
  const pulseTimerRef = useRef(null);

  const startFooterPulse = useCallback((count) => {
    if (count <= 0) return;
    setPulseBadgeCount(count);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setPulseBadgeCount(0);
      pulseTimerRef.current = null;
    }, FOOTER_PULSE_MS);
  }, []);

  const hydratePersisted = useCallback(async () => {
    if (!isAuthenticated || !user?.email) return;
    try {
      const data = await workflowNotificacoesApi.list();
      const rows = (data?.notificacoes || []).map(mapPersistedNotification);
      const unreadRows = rows.filter((row) => !row.lida && row.persistId);
      const fresh = unreadRows.filter((row) => {
        const unseen = !seenIdsRef.current.has(row.persistId);
        return unseen && isRecentNotification(row);
      });
      unreadRows.forEach((row) => seenIdsRef.current.add(row.persistId));

      setNotifications((prev) => {
        const ephemeral = prev.filter((n) => !n.persistId);
        return [...rows, ...ephemeral].slice(0, 40);
      });
      setUnreadPersisted(data?.unread ?? 0);

      if (fresh.length) {
        startFooterPulse(fresh.length);
        try {
          window.dispatchEvent(new CustomEvent('velodesk:desk-notifications-changed'));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn('NotificationContext: rate limit ao carregar notificações.', RATE_LIMIT_USER_MESSAGE);
      }
      /* API indisponível — mantém só toasts locais */
    }
  }, [isAuthenticated, user?.email, startFooterPulse]);

  useEffect(() => {
    hydratePersisted();
    const timer = setInterval(hydratePersisted, HYDRATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hydratePersisted]);

  useEffect(() => {
    const unsubscribe = subscribeToTicketEvents((payload) => {
      if (payload?.type === 'workflow') hydratePersisted();
    });
    return unsubscribe;
  }, [hydratePersisted]);

  useEffect(() => () => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
  }, []);

  const showNotification = useCallback((message, type = 'info') => {
    const id = `toast-${Date.now()}`;
    setNotifications((prev) => [{ id, message, type }, ...prev].slice(0, 40));
    const el = document.createElement('div');
    el.className = 'cockpit-toast cockpit-toast--' + type;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('is-visible'), 10);
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 300);
    }, TOAST_VISIBLE_MS);
  }, []);

  const markPersistedRead = useCallback(async (persistId) => {
    if (!persistId) return;
    try {
      await workflowNotificacoesApi.markRead(persistId);
      setNotifications((prev) => prev.map((n) => (
        n.persistId === persistId ? { ...n, lida: true } : n
      )));
      setUnreadPersisted((count) => Math.max(0, count - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);

  const badgeCount = unreadPersisted + notifications.filter((n) => !n.persistId && !n.lida).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      panelOpen,
      togglePanel,
      showNotification,
      hydratePersisted,
      markPersistedRead,
      badgeCount,
      pulseBadgeCount,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications requires NotificationProvider');
  return ctx;
}
