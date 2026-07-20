/**
 * PermissionContext v1.0.0 — permissões RBAC da sessão
 * VERSION: v1.0.0 | DATE: 2026-07-17
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  can,
  canActOnTicket,
  canApproveWorkflow,
  clearCachedPermissions,
  fetchMyPermissions,
  filterTicketForUser,
  isPortalAllowed,
  readCachedPermissions,
  shouldUseMeusChamadosFila,
} from '../services/permissions/permissionService';

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState(() => readCachedPermissions());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyPermissions();
      setPermissions(data);
      return data;
    } catch (err) {
      setError(err?.message || 'Erro ao carregar permissões');
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
    const token = localStorage.getItem('velodesk_token');
    if (token && !permissions) {
      void reload().catch(() => {});
    }
  }, [permissions, reload]);

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
    portalVisivel: permissions?.portalVisivel || ['agent'],
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
