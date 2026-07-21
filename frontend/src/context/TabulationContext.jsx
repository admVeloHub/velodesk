/**
 * TabulationContext v1.3.0 — opções dinâmicas + tratamento 429
 * VERSION: v1.3.0 | DATE: 2026-07-21 | AUTHOR: VeloHub Development Team
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tabulationApi } from '../api/client';
import { isRateLimitError, RATE_LIMIT_USER_MESSAGE } from '../utils/apiErrors';
import { useAuth } from './AuthContext';
import {
  EMPTY_TABULATION,
  getCanalContatoOptions,
  getDetalhes,
  getMotivos,
  getProdutoNames,
  getTipoChamadoOptions,
} from '../services/tabulationConfig';

const TabulationContext = createContext(null);

export function TabulationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [config, setConfig] = useState(EMPTY_TABULATION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setConfig(EMPTY_TABULATION);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const data = await tabulationApi.getActive();
        setConfig(data || EMPTY_TABULATION);
        setLoading(false);
        return;
      } catch (err) {
        const status = err?.response?.status;
        if (isRateLimitError(err)) {
          setError(RATE_LIMIT_USER_MESSAGE);
          setConfig(EMPTY_TABULATION);
          setLoading(false);
          return;
        }
        const isTransient = status === 503 && attempt < maxAttempts;
        if (isTransient) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          continue;
        }
        setError(err?.response?.data?.message || err?.message || 'Falha ao carregar tabulação');
        setConfig(EMPTY_TABULATION);
        setLoading(false);
        return;
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({
    config,
    loading,
    error,
    reload,
    getProdutoNames: () => getProdutoNames(config),
    getMotivos: (produto) => getMotivos(config, produto),
    getDetalhes: (produto, motivo) => getDetalhes(config, produto, motivo),
    getTipoChamadoOptions: () => getTipoChamadoOptions(config),
    getCanalContatoOptions: () => getCanalContatoOptions(config),
  }), [config, loading, error, reload]);

  return (
    <TabulationContext.Provider value={value}>
      {children}
    </TabulationContext.Provider>
  );
}

export function useTabulation() {
  const ctx = useContext(TabulationContext);
  if (!ctx) throw new Error('useTabulation deve ser usado dentro de TabulationProvider');
  return ctx;
}
