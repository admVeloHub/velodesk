/**
 * useWorkspace360 v1.0.1 — hook do Painel 360° (dados reais)
 * VERSION: v1.0.1 | DATE: 2026-07-14
 */
import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { fetchWorkspace360 } from '../services/workspace/workspace360Api';

export function useWorkspace360(options = {}) {
  const { enabled = true, reportParams } = options;
  const { profileId } = useProfile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const params = profileId === 'gestao' || profileId === 'supervisor'
        ? (reportParams || {})
        : undefined;
      const payload = await fetchWorkspace360(params);
      setData(payload);
      return payload;
    } catch (err) {
      setError(err);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, profileId, reportParams]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
