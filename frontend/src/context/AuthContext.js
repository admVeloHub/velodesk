/**
 * AuthContext v1.0.0 — JWT Velodesk
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('velodesk_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('velodesk_token'));

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('velodesk_token', data.token);
    localStorage.setItem('velodesk_user', JSON.stringify(data.user));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('velodesk_token');
    localStorage.removeItem('velodesk_user');
    localStorage.removeItem('isLoggedIn');
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout, isAuthenticated: !!token }),
    [user, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
