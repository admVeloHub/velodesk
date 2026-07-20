/**
 * AuthContext v1.7.0 — login oficial cadastro Desk (sem allowlist)
 * VERSION: v1.7.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
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

function colaboradorHasDeskAccess(colaborador) {
  if (!colaborador || typeof colaborador !== 'object') return false;
  if (colaborador.desligado === true || colaborador.afastado === true) return false;
  return colaborador.acessos?.Desk === true || colaborador.acessos?.desk === true;
}

function readInitialAuth() {
  const gateOk = localStorage.getItem('velodesk_gate_authorized') === '1';
  const user = readStoredUser();
  const token = localStorage.getItem('velodesk_token');
  const session = readHubSession();
  const colaborador = readStoredColaborador();

  if (gateOk && user) {
    if (isLegacyDeskUser(user)) {
      clearStoredAuthSession();
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (isGoogleDeskSession(user) || user.source === 'cadastro-desk') {
      if (!isBackendJwtUsable(token) || !colaboradorHasDeskAccess(colaborador)) {
        clearStoredAuthSession();
        return { authStatus: 'pending', user: null, colaborador: null, token: null };
      }
      const displayName = user.name || getDeskDisplayName(user) || user.email;
      const normalizedUser = { ...user, name: displayName };
      return {
        authStatus: 'authorized',
        user: normalizedUser,
        colaborador,
        token,
      };
    }

    // Modo Google: não aceita sessão legada sem cadastro Desk
    if (isGoogleDeskAuthMode()) {
      clearStoredAuthSession();
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (!isLocalDevBypass() && session && !isHubSessionActive(session)) {
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    if (!isBackendJwtUsable(token)) {
      clearStoredAuthSession();
      return { authStatus: 'pending', user: null, colaborador: null, token: null };
    }

    return {
      authStatus: 'authorized',
      user,
      colaborador,
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
    const colaboradorPayload = result.colaborador || null;
    const displayName = result.user?.name
      || colaboradorPayload?.colaboradorNome
      || getDeskDisplayName(result.user?.email);
    const enrichedUser = {
      ...result.user,
      name: displayName,
      source: result.user?.source || 'google-desk',
    };
    setUser(enrichedUser);
    setColaborador(colaboradorPayload);
    setToken(result.token);
    localStorage.setItem('velodesk_user', JSON.stringify(enrichedUser));
    if (colaboradorPayload) {
      localStorage.setItem('velodesk_colaborador', JSON.stringify(colaboradorPayload));
      localStorage.setItem('velodesk_colaborador_meta', JSON.stringify({
        atuacao: colaboradorPayload.atuacao || [],
        departamento: colaboradorPayload.departamento || '',
      }));
    } else {
      localStorage.removeItem('velodesk_colaborador');
    }
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
