/**
 * AuthContext v1.1.0 — JWT Velodesk + bypass localhost dev
 * VERSION: v1.1.0 | DATE: 2026-06-19 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { authApi } from '../api/client';
import { applyLocalDevSession, isLocalDevBypass } from '../config/devAuth';

const AuthContext = createContext(null);

function readInitialSession() {
  if (isLocalDevBypass()) {
    return applyLocalDevSession();
  }
  const raw = localStorage.getItem('velodesk_user');
  return {
    token: localStorage.getItem('velodesk_token'),
    user: raw ? JSON.parse(raw) : null,
  };
}

export function AuthProvider({ children }) {
  const [session] = useState(readInitialSession);
  const [user, setUser] = useState(session.user);
  const [token, setToken] = useState(session.token);

  const login = useCallback(async (email, password) => {
    if (isLocalDevBypass()) {
      const session = applyLocalDevSession();
      setToken(session.token);
      setUser(session.user);
      return;
    }
    const data = await authApi.login(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('velodesk_token', data.token);
    localStorage.setItem('velodesk_user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    if (isLocalDevBypass()) return;
    setToken(null);
    setUser(null);
    localStorage.removeItem('velodesk_token');
    localStorage.removeItem('velodesk_user');
    localStorage.removeItem('isLoggedIn');
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const base = prev || { id: 'local', name: 'Ana Silva', email: '' };
      const next = { ...base, ...partial };
      localStorage.setItem('velodesk_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser, isAuthenticated: !!token }),
    [user, token, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
