/**
 * TicketsContext v1.5.0 — tratamento 429 + recarga quando sessão/papel muda
 * VERSION: v1.5.0 | DATE: 2026-07-21 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { findTicketEntry, getTicketColumns, refreshTicketsFromApi } from '../services/ticketsStorage';
import { getTicketProtocolLabel } from '../services/desk/utils';
import { isRateLimitError, RATE_LIMIT_USER_MESSAGE } from '../utils/apiErrors';
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
  const { isAuthenticated, user } = useAuth();
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshTickets = useCallback(async () => {
    if (isAuthenticated) {
      setLoading(true);
      try {
        await refreshTicketsFromApi();
      } catch (err) {
        const status = err?.response?.status;
        const apiMsg = String(err?.response?.data?.message || '').trim();
        if (status === 401 || status === 403) {
          console.warn('TicketsContext: sessão inválida ao carregar tickets — faça login novamente.');
        } else if (isRateLimitError(err)) {
          console.warn('TicketsContext: rate limit ao carregar tickets.', RATE_LIMIT_USER_MESSAGE);
        } else if (status === 503 || /mongodb|banco/i.test(apiMsg)) {
          console.warn('TicketsContext: backend/Mongo indisponível ao carregar tickets.');
        } else {
          console.warn('TicketsContext: falha ao carregar tickets.', apiMsg || err?.message);
        }
      } finally {
        setLoading(false);
      }
    }
    setRefreshKey((k) => k + 1);
    return getTicketColumns();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refreshTickets();
  }, [isAuthenticated, refreshTickets, user?.email, user?.role]);

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
      getTicketColumns,
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
