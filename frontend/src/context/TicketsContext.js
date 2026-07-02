/**
 * TicketsContext v1.2.0 — estado global tickets / abas + API
 * VERSION: v1.2.1 | DATE: 2026-06-23 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { findTicketEntry, getKanbanColumns, refreshKanbanFromApi } from '../services/kanbanStorage';
import { getTicketProtocolLabel } from '../services/desk/utils';
import { useAuth } from './AuthContext';

const TicketsContext = createContext(null);

function buildTabMeta(entry) {
  const t = entry.ticket;
  const clientName = t.clientName || t.solicitante || 'Cliente';
  const protocol = getTicketProtocolLabel(t);
  const ticketLabel = protocol || (t.isDraft || String(t.id).startsWith('draft-') ? 'Rascunho' : '');
  return {
    id: t.id,
    title: t.title || (protocol ? `Ticket ${protocol}` : 'Ticket'),
    clientName,
    ticketLabel,
  };
}

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
    return getKanbanColumns();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refreshTickets();
  }, [isAuthenticated, refreshTickets]);

  useEffect(() => {
    setOpenTabs((prev) =>
      prev
        .map((tab) => {
          const entry = findTicketEntry(tab.id);
          if (!entry) return null;
          return { ...tab, ...buildTabMeta(entry) };
        })
        .filter(Boolean)
    );
  }, [refreshKey]);

  const openTicket = useCallback((ticketId) => {
    const entry = findTicketEntry(ticketId);
    if (!entry) return;
    const meta = buildTabMeta(entry);
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => String(t.id) === String(ticketId));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...meta };
        return next;
      }
      return [...prev, meta];
    });
    setActiveTabId(ticketId);
  }, [refreshKey]);

  const closeTicketTab = useCallback((ticketId) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => String(t.id) !== String(ticketId));
      setActiveTabId((current) => {
        if (String(current) !== String(ticketId)) return current;
        return next.length ? next[next.length - 1].id : null;
      });
      return next;
    });
  }, []);

  const selectTicketFromModal = useCallback((ticketId, navigateFn) => {
    openTicket(ticketId);
    if (navigateFn) navigateFn('/tickets?desk=v2');
  }, [openTicket]);

  const replaceOpenTabId = useCallback((oldId, newId, meta = {}) => {
    setOpenTabs((prev) =>
      prev.map((tab) =>
        String(tab.id) === String(oldId)
          ? { ...tab, id: newId, ...meta }
          : tab
      )
    );
    setActiveTabId((current) => (String(current) === String(oldId) ? newId : current));
  }, []);

  return (
    <TicketsContext.Provider value={{
      openTabs,
      activeTabId,
      refreshKey,
      loading,
      openTicket,
      closeTicketTab,
      replaceOpenTabId,
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
