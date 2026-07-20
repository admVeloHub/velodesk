/**
 * useAgentesDesk v1.1.0 — agentes importados do VeloHub (read-only)
 */
import { useCallback, useEffect, useState } from 'react';
import { agentesDeskApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function useAgentesDesk() {
  const { isAuthenticated } = useAuth();
  const [agentes, setAgentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
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

  const syncFromVelohub = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await agentesDeskApi.sync();
      setAgentes(Array.isArray(result?.agentes) ? result.agentes : []);
      return result;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Falha ao importar do VeloHub';
      setError(msg);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    agentes,
    loading,
    syncing,
    error,
    reload,
    syncFromVelohub,
  };
}
