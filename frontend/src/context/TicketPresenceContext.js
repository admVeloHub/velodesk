/**
 * TicketPresenceContext v1.1.0 — presence desliga sozinho quando o servidor responde 503
 * VERSION: v1.1.0 | DATE: 2026-08-17
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTickets } from './TicketsContext';
import {
  isTicketPresenceConfigured,
  startTicketPresence,
  stopTicketPresence,
  subscribeToTicketPresence,
  updateMyTicketPresence,
} from '../services/presence/ticketPresenceRealtime';

const TicketPresenceContext = createContext(null);

export function TicketPresenceProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const { openTabs, activeTabId } = useTickets();
  const [othersPresence, setOthersPresence] = useState({});

  useEffect(() => {
    if (!isAuthenticated || !user?.email || !isTicketPresenceConfigured()) {
      return undefined;
    }

    void startTicketPresence({ userKey: user.email, name: user.name || user.email });
    const unsubscribe = subscribeToTicketPresence(setOthersPresence);

    return () => {
      unsubscribe();
      stopTicketPresence();
      setOthersPresence({});
    };
  }, [isAuthenticated, user?.email, user?.name]);

  useEffect(() => {
    if (!isAuthenticated || !isTicketPresenceConfigured()) return;
    updateMyTicketPresence({
      activeTicketId: activeTabId,
      openTicketIds: openTabs.map((tab) => tab.id),
    });
  }, [isAuthenticated, activeTabId, openTabs]);

  const presenceByTicketId = useMemo(() => {
    const map = {};
    Object.entries(othersPresence).forEach(([key, meta]) => {
      const agent = { key, name: meta.name || key };
      if (meta.activeTicketId) {
        const bucket = map[meta.activeTicketId] || (map[meta.activeTicketId] = []);
        bucket.push({ ...agent, state: 'focused' });
      }
      (meta.openTicketIds || []).forEach((ticketId) => {
        if (ticketId === meta.activeTicketId) return;
        const bucket = map[ticketId] || (map[ticketId] = []);
        bucket.push({ ...agent, state: 'background' });
      });
    });
    return map;
  }, [othersPresence]);

  const value = useMemo(() => ({ presenceByTicketId }), [presenceByTicketId]);

  return (
    <TicketPresenceContext.Provider value={value}>
      {children}
    </TicketPresenceContext.Provider>
  );
}

export function useTicketPresence(ticketId) {
  const ctx = useContext(TicketPresenceContext);
  if (!ctx) throw new Error('useTicketPresence requires TicketPresenceProvider');
  const key = ticketId ? String(ticketId) : '';
  return key ? (ctx.presenceByTicketId[key] || []) : [];
}

/** Mapa completo ticketId -> agentes presentes, para listas que precisam consultar vários tickets sem um hook por item. */
export function useTicketPresenceMap() {
  const ctx = useContext(TicketPresenceContext);
  if (!ctx) throw new Error('useTicketPresenceMap requires TicketPresenceProvider');
  return ctx.presenceByTicketId;
}
