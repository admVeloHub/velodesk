/**
 * useModuleStatus v1.0.0 — status real dos serviços (Painel 360°), via VelohubCentral/
 * console_config/module_status (mesma fonte do mostrador de serviços do VeloHub).
 * VERSION: v1.0.0 | DATE: 2026-08-31
 */
import { useCallback, useEffect, useState } from 'react';
import { moduleStatusApi } from '../api/client';

const POLL_INTERVAL_MS = 60_000;

export function useModuleStatus() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await moduleStatusApi.list();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { items, loading, refresh };
}
