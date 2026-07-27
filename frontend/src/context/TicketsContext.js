/**
 * TicketsContext v1.7.0 — refresh silencioso das filas (atualização automática do Desk)
 * VERSION: v1.7.0 | DATE: 2026-07-27 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { findTicketEntry, getTicketColumns, refreshTicketsFromApi } from '../services/ticketsStorage';
import { hydrateColumnsFromStorage, patchTicketInCache } from '../services/ticketsCache';
import { getTicketProtocolLabel } from '../services/desk/utils';
import deskLog from '../utils/deskDebugLog';
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
  const hydratedRef = useRef(false);

  const patchTicket = useCallback((ticketId, ticket) => {
    if (patchTicketInCache(ticketId, ticket)) {
      setRefreshKey((k) => k + 1);
    }
  }, []);

  const runRefresh = useCallback(async (silent) => {
    if (isAuthenticated) {
      if (!silent) setLoading(true);
      deskLog.tickets('TicketsContext.refreshTickets → início', { silent: Boolean(silent) });
      try {
        await refreshTicketsFromApi(user?.email);
        deskLog.tickets('TicketsContext.refreshTickets → ok');
      } catch (err) {
        const status = err?.response?.status;
        const apiMsg = String(err?.response?.data?.message || '').trim();
        deskLog.error('TICKETS', 'TicketsContext.refreshTickets → falhou', {
          status,
          message: apiMsg || err?.message,
          silent: Boolean(silent),
        });
        if (silent) {
          // Atualização de fundo: falha de rede não deve poluir o console do agente
        } else if (status === 401 || status === 403) {
          console.warn('TicketsContext: sessão inválida ao carregar tickets — faça login novamente.');
        } else if (status === 503 || /mongodb|banco/i.test(apiMsg)) {
          console.warn('TicketsContext: backend/Mongo indisponível ao carregar tickets.');
        } else {
          console.warn('TicketsContext: falha ao carregar tickets.', apiMsg || err?.message);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    }
    setRefreshKey((k) => k + 1);
    return getTicketColumns();
  }, [isAuthenticated, user?.email]);

  const refreshTickets = useCallback(() => runRefresh(false), [runRefresh]);

  /** Atualização de fundo: sem spinner e sem ruído de log */
  const refreshTicketsSilent = useCallback(() => runRefresh(true), [runRefresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      hydratedRef.current = false;
      return;
    }
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (hydrateColumnsFromStorage(user?.email)) {
        deskLog.tickets('TicketsContext: cache local hidratado');
        setRefreshKey((k) => k + 1);
      }
    }
    refreshTickets();
  }, [isAuthenticated, refreshTickets, user?.email, user?.role]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const reloadOnPermissions = () => {
      deskLog.tickets('TicketsContext: permissões atualizadas → recarregar filas');
      void refreshTickets();
    };
    window.addEventListener('velodesk:permissions', reloadOnPermissions);
    return () => window.removeEventListener('velodesk:permissions', reloadOnPermissions);
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
      refreshTicketsSilent,
      selectTicketFromModal,
      getTicketColumns,
      patchTicket,
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
