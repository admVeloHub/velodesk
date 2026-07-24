/**
 * PermissionContext v1.4.0 — deskLog diagnóstico
 * VERSION: v1.4.0 | DATE: 2026-07-24
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import deskLog from '../utils/deskDebugLog';
import {
  can,
  canActOnTicket,
  canApproveWorkflow,
  clearCachedPermissions,
  fetchMyPermissions,
  filterTicketForUser,
  getPortalVisivel,
  isPortalAllowed,
  readCachedPermissions,
  shouldUseMeusChamadosFila,
} from '../services/permissions/permissionService';
import { isRateLimitError, RATE_LIMIT_USER_MESSAGE } from '../utils/apiErrors';

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [permissions, setPermissions] = useState(() => readCachedPermissions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      deskLog.perm('reload → início');
      const data = await fetchMyPermissions();
      setPermissions(data);
      deskLog.perm('reload → ok', {
        funcaoSlug: data?.funcaoSlug,
        portalVisivel: data?.portalVisivel,
      });
      return data;
    } catch (err) {
      const message = isRateLimitError(err)
        ? RATE_LIMIT_USER_MESSAGE
        : (err?.message || 'Erro ao carregar permissões');
      deskLog.error('PERMISSOES', 'reload → falhou', {
        status: err?.response?.status,
        message: err?.response?.data?.message || message,
      });
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    clearCachedPermissions();
    setPermissions(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      clear();
      return;
    }
    void reload().catch(() => {});
  }, [isAuthenticated, user?.email, reload, clear]);

  const api = useMemo(() => ({
    permissions,
    loading,
    error,
    reload,
    clear,
    can: (modulo, key) => can(modulo, key, permissions?.permissoes),
    canActOnTicket: (ticket) => canActOnTicket(ticket, permissions),
    canApproveWorkflow: () => canApproveWorkflow(permissions),
    filterTicketForUser: (ticket) => filterTicketForUser(ticket, permissions),
    shouldUseMeusChamadosFila: () => shouldUseMeusChamadosFila(permissions),
    isPortalAllowed: (portalId) => isPortalAllowed(portalId, permissions),
    funcaoSlug: permissions?.funcaoSlug || 'atendimento',
    portalVisivel: getPortalVisivel(permissions),
  }), [permissions, loading, error, reload, clear]);

  return (
    <PermissionContext.Provider value={api}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions requires PermissionProvider');
  return ctx;
}

export function usePermissionsOptional() {
  return useContext(PermissionContext);
}
