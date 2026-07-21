/**
 * NotificationContext v1.2.0 — sininho + tratamento 429 no poll
 * VERSION: v1.2.0 | DATE: 2026-07-21
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { workflowNotificacoesApi } from '../api/client';
import { isRateLimitError, RATE_LIMIT_USER_MESSAGE } from '../utils/apiErrors';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

function mapPersistedNotification(row) {
  return {
    id: `wf-${row._id}`,
    persistId: row._id,
    message: row.titulo ? `${row.titulo}: ${row.mensagem}` : row.mensagem,
    type: 'workflow-cta',
    ticketId: row.ticketId,
    protocolo: row.chamadoProtocolo,
    lida: row.lida,
    createdAt: row.createdAt,
  };
}

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadPersisted, setUnreadPersisted] = useState(0);

  const hydratePersisted = useCallback(async () => {
    if (!isAuthenticated || !user?.email) return;
    try {
      const data = await workflowNotificacoesApi.list();
      const rows = (data?.notificacoes || []).map(mapPersistedNotification);
      setNotifications((prev) => {
        const ephemeral = prev.filter((n) => !n.persistId);
        return [...rows, ...ephemeral].slice(0, 40);
      });
      setUnreadPersisted(data?.unread ?? 0);
    } catch (err) {
      if (isRateLimitError(err)) {
        console.warn('NotificationContext: rate limit ao carregar notificações.', RATE_LIMIT_USER_MESSAGE);
      }
      /* API indisponível — mantém só toasts locais */
    }
  }, [isAuthenticated, user?.email]);

  useEffect(() => {
    hydratePersisted();
    const timer = setInterval(hydratePersisted, 60000);
    return () => clearInterval(timer);
  }, [hydratePersisted]);

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
    }, 3200);
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
