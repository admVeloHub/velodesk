/**
 * TicketsContext v1.1.0 — estado global tickets / abas + API
 * VERSION: v1.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { findTicketEntry, getKanbanColumns, refreshKanbanFromApi } from '../services/kanbanStorage';
import { useAuth } from './AuthContext';

const TicketsContext = createContext(null);

export function TicketsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshTickets = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        await refreshKanbanFromApi();
      } finally {
        setLoading(false);
      }
    }
    setRefreshKey((k) => k + 1);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refreshTickets();
  }, [isAuthenticated, refreshTickets]);

  const openTicket = useCallback((ticketId) => {
    const entry = findTicketEntry(ticketId);
    if (!entry) return;
    setOpenTabs((prev) => {
      if (prev.some((t) => String(t.id) === String(ticketId))) return prev;
      return [...prev, { id: entry.ticket.id, title: entry.ticket.title || 'Ticket #' + ticketId }];
    });
    setActiveTabId(ticketId);
  }, [refreshKey]);

  const closeTicketTab = useCallback((ticketId) => {
    setOpenTabs((prev) => prev.filter((t) => String(t.id) !== String(ticketId)));
    setActiveTabId((current) => (String(current) === String(ticketId) ? null : current));
  }, []);

  const selectTicketFromModal = useCallback((ticketId, navigateFn) => {
    openTicket(ticketId);
    if (navigateFn) navigateFn('/tickets?desk=v2');
  }, [openTicket]);

  return (
    <TicketsContext.Provider value={{
      openTabs,
      activeTabId,
      refreshKey,
      loading,
      openTicket,
      closeTicketTab,
      setActiveTabId,
      refreshTickets,
      selectTicketFromModal,
      getKanbanColumns,
    }}>
      {children}
    </TicketsContext.Provider>
  );
}

export function useTickets() {
  const ctx = useContext(TicketsContext);
  if (!ctx) throw new Error('useTickets requires TicketsProvider');
  return ctx;
}
