/**
 * NotificationContext
 * VERSION: v1.0.0 | DATE: 2026-06-18
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const showNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications((prev) => [{ id, message, type }, ...prev].slice(0, 20));
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

  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      panelOpen,
      togglePanel,
      showNotification,
      badgeCount: notifications.length
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
