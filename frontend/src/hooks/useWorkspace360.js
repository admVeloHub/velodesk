/**
 * useWorkspace360 v1.2.0 — Painel 360° alinhado ao perfil operacional
 * VERSION: v1.2.0 | DATE: 2026-08-17
 */
import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { usePermissions } from '../context/PermissionContext';
import { fetchWorkspace360 } from '../services/workspace/workspace360Api';

function buildQueryParams(profileId, canSeeEquipe, reportParams) {
  if (profileId === 'gestao' || canSeeEquipe) {
    return { profile: 'gestao', ...(reportParams || {}) };
  }
  if (profileId === 'agent' || profileId === 'especiais') {
    return { profile: 'agent' };
  }
  return reportParams || undefined;
}

export function useWorkspace360(options = {}) {
  const { enabled = true, reportParams } = options;
  const { profileId } = useProfile();
  const { can } = usePermissions();
  const canSeeEquipe = can('workspace', 'painel_360_equipe');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams(profileId, canSeeEquipe, reportParams);
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
  }, [enabled, profileId, canSeeEquipe, reportParams]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
