/**
 * useAgentesDesk v1.3.0 — lista via GET (VeloHub ao vivo); sem sync manual
 * VERSION: v1.3.0 | DATE: 2026-07-24
 */
import { useCallback, useEffect, useState } from 'react';
import { agentesDeskApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useAgentesDesk() {
  const { isAuthenticated } = useAuth();
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setAgentes([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const list = await agentesDeskApi.list();
      setAgentes(Array.isArray(list) ? list : []);
    } catch (err) {
      setAgentes([]);
      setError(err?.response?.data?.message || err?.message || 'Falha ao carregar agentes');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    agentes,
    loading,
    error,
    reload,
  };
}
