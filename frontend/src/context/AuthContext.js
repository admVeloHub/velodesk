/**

 * AuthContext v1.3.2 — sessão VeloHub + JWT backend obrigatório

 * VERSION: v1.3.2 | DATE: 2026-06-25 | AUTHOR: VeloHub Development Team

 */

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

import { authApi } from '../api/client';

import { DEV_LOCAL_TOKEN, isLocalDevBypass } from '../config/devAuth';

import { isHubSessionActive, readHubSession } from '../config/hubSession';

import { setApiMode } from '../services/ticketsCache';



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



function hasValidBackendJwt(token) {

  if (!token || token === DEV_LOCAL_TOKEN) return false;

  try {

    const payload = JSON.parse(atob(token.split('.')[1]));

    const userId = String(payload.userId ?? payload.sub ?? '').trim();

    return /^[a-f0-9]{24}$/i.test(userId);

  } catch {

    return false;

  }

}



function readInitialAuth() {

  const gateOk = localStorage.getItem('velodesk_gate_authorized') === '1';

  const user = readStoredUser();

  const token = localStorage.getItem('velodesk_token');

  const session = readHubSession();



  if (gateOk && user) {

    if (!isLocalDevBypass() && session && !isHubSessionActive(session)) {

      return { authStatus: 'pending', user: null, colaborador: null, token: null };

    }

    if (isLocalDevBypass() && !hasValidBackendJwt(token)) {

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

    setApiMode(true);

    if (isLocalDevBypass()) {

      const data = await authApi.login('admin@velodesk.local', 'admin123');

      if (!data?.token) {

        throw new Error('Backend não retornou token de autenticação.');

      }

      setToken(data.token);

      localStorage.setItem('velodesk_token', data.token);

    }



    setAuthStatus('authorized');

  }, []);



  const logout = useCallback(() => {

    /* logout é responsabilidade do VeloHub */

  }, []);



  const updateUser = useCallback((partial) => {

    setUser((prev) => {

      const base = prev || { id: 'local', name: '', email: '' };

      const next = { ...base, ...partial };

      localStorage.setItem('velodesk_user', JSON.stringify(next));

      return next;

    });

  }, []);



  const clearGateSession = useCallback(() => {

    setAuthStatus('pending');

    setUser(null);

    setColaborador(null);

    setToken(null);

    localStorage.removeItem('velodesk_gate_authorized');

    localStorage.removeItem('velodesk_user');

    localStorage.removeItem('velodesk_colaborador');

    localStorage.removeItem('velodesk_token');

  }, []);



  const value = useMemo(

    () => ({

      user,

      colaborador,

      token,

      authStatus,

      bootstrapFromGate,

      logout,

      updateUser,

      clearGateSession,

      isAuthenticated: authStatus === 'authorized',

    }),

    [user, colaborador, token, authStatus, bootstrapFromGate, logout, updateUser, clearGateSession],

  );



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}



export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth fora de AuthProvider');

  return ctx;

}

