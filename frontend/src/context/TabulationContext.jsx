/**
 * TabulationContext v1.0.0 — config dinâmica de tabulação
 * VERSION: v1.0.0 | DATE: 2026-06-25
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tabulationApi } from '../api/client';
import {
  EMPTY_TABULATION,
  getDetalhes,
  getMotivos,
  getProdutoNames,
} from '../services/tabulationConfig';

const TabulationContext = createContext(null);

export function TabulationProvider({ children }) {
  const [config, setConfig] = useState(EMPTY_TABULATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tabulationApi.getActive();
      setConfig(data || EMPTY_TABULATION);
    } catch (err) {
      setError(err?.message || 'Falha ao carregar tabulação');
      setConfig(EMPTY_TABULATION);
    } finally {
      setLoading(false);
    }
  }, []);

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
