/**
 * useWorkspace360 v1.1.0 — Painel 360° alinhado ao perfil operacional
 * VERSION: v1.1.0 | DATE: 2026-07-15
 */
import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { fetchWorkspace360 } from '../services/workspace/workspace360Api';

function buildQueryParams(profileId, reportParams) {
  if (profileId === 'gestao') {
    return { profile: 'gestao', ...(reportParams || {}) };
  }
  if (profileId === 'agent') {
    return { profile: 'agent' };
  }
  return reportParams || undefined;
}

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
      const params = buildQueryParams(profileId, reportParams);
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
