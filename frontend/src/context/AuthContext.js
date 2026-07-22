/**
 * AuthContext v1.6.0 — valida exp do JWT + limpa sessão inválida no boot
 * VERSION: v1.6.0 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { resolveDeskAccessRole } from '../config/deskAccessAllowlist';
import { isGoogleDeskAuthMode, isGoogleDeskSession } from '../config/deskAuthMode';
import { isLocalDevBypass } from '../config/devAuth';
import { isHubSessionActive, readHubSession } from '../config/hubSession';
import { setApiMode } from '../services/ticketsCache';
import { getDeskDisplayName, isLegacyDeskUser } from '../utils/userDisplayName';
import { clearDeskAuthSession, isBackendJwtUsable } from '../utils/backendJwt';
import { clearCachedPermissions } from '../services/permissions/permissionService';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem('velodesk_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredColaborador() {
  try {
    const raw = localStorage.getItem('velodesk_colaborador');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearStoredAuthSession() {
  clearDeskAuthSession();
  clearCachedPermissions();
}

function isAllowedGoogleUser(user) {
  if (!user?.email) return false;
  if (isLegacyDeskUser(user)) return false;
  return Boolean(resolveDeskAccessRole(user.email));
}

function readInitialAuth() {
  const gateOk = localStorage.getItem('velodesk_gate_authorized') === '1';
  const user = readStoredUser();
  const token = localStorage.getItem('velodesk_token');
  const session = readHubSession();

  if (gateOk && user) {
    if (isLegacyDeskUser(user) || (isGoogleDeskAuthMode() && !isAllowedGoogleUser(user))) {
      clearStoredAuthSession();
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (isGoogleDeskSession(user)) {
      if (!isBackendJwtUsable(token) || !isAllowedGoogleUser(user)) {
        clearStoredAuthSession();
        return { authStatus: 'pending', user: null, colaborador: null, token: null };
      }
      const displayName = getDeskDisplayName(user);
      const normalizedUser = { ...user, name: displayName };
      return {
        authStatus: 'authorized',
        user: normalizedUser,
        colaborador: readStoredColaborador(),
        token,
      };
    }

    if (!isLocalDevBypass() && session && !isHubSessionActive(session)) {
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (isLocalDevBypass() && !isBackendJwtUsable(token)) {
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (!isLocalDevBypass() && !isBackendJwtUsable(token)) {
      clearStoredAuthSession();
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    return {
      authStatus: 'authorized',
      user,
      colaborador: readStoredColaborador(),
      token,
    };
  }

  return { authStatus: 'pending', user: null, colaborador: null, token: null };
}

export function AuthProvider({ children }) {
  const [initial] = useState(readInitialAuth);
  const [authStatus, setAuthStatus] = useState(initial.authStatus);
  const [user, setUser] = useState(initial.user);
  const [colaborador, setColaborador] = useState(initial.colaborador);
  const [token, setToken] = useState(initial.token);

  const bootstrapFromGate = useCallback(async (result) => {
    setUser(result.user);
    setColaborador(result.colaborador || null);
    localStorage.setItem('velodesk_user', JSON.stringify(result.user));
    if (result.colaborador) {
      localStorage.setItem('velodesk_colaborador', JSON.stringify(result.colaborador));
    }
    localStorage.setItem('velodesk_gate_authorized', '1');
    localStorage.setItem('velodesk_auth_mode', 'velohub');
    setApiMode(true);
    setAuthStatus('authorized');
  }, []);

  const bootstrapFromGoogleLogin = useCallback(async (result) => {
    const displayName = getDeskDisplayName(result.user?.email);
    const enrichedUser = {
      ...result.user,
      name: displayName,
      source: 'google-desk',
    };
    setUser(enrichedUser);
    setColaborador(null);
    setToken(result.token);
    localStorage.setItem('velodesk_user', JSON.stringify(enrichedUser));
    localStorage.removeItem('velodesk_colaborador');
    localStorage.setItem('velodesk_token', result.token);
    localStorage.setItem('velodesk_gate_authorized', '1');
    localStorage.setItem('velodesk_auth_mode', 'google');
    setApiMode(true);
    setAuthStatus('authorized');
  }, []);

  const logout = useCallback(() => {
    try {
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* noop */
    }
    clearStoredAuthSession();
    setAuthStatus('pending');
    setUser(null);
    setColaborador(null);
    setToken(null);
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const base = prev || { id: 'local', name: '', email: '' };
      const next = { ...base, ...partial };
      if (next.email && !partial?.name) {
        next.name = getDeskDisplayName(next.email);
      }
      localStorage.setItem('velodesk_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearGateSession = useCallback(() => {
    clearStoredAuthSession();
    setAuthStatus('pending');
    setUser(null);
    setColaborador(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      colaborador,
      token,
      authStatus,
      bootstrapFromGate,
      bootstrapFromGoogleLogin,
      logout,
      updateUser,
      clearGateSession,
      isAuthenticated: authStatus === 'authorized',
    }),
    [
      user,
      colaborador,
      token,
      authStatus,
      bootstrapFromGate,
      bootstrapFromGoogleLogin,
      logout,
      updateUser,
      clearGateSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
