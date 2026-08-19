/**
 * useWorkspace360 v1.3.0 — aguarda permissões antes do fetch (evita double-fetch)
 * VERSION: v1.3.0 | DATE: 2026-08-19
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const { can, loading: permissionsLoading } = usePermissions();
  const canSeeEquipe = useMemo(
    () => can('workspace', 'painel_360_equipe'),
    [can],
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEnabled = enabled && !permissionsLoading;

  const refresh = useCallback(async () => {
    if (!fetchEnabled) return null;
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
  }, [fetchEnabled, profileId, canSeeEquipe, reportParams]);

  useEffect(() => {
    if (!fetchEnabled) return;
    refresh();
  }, [fetchEnabled, refresh]);

  return {
    data,
    loading: loading || permissionsLoading,
    error,
    refresh,
  };
}
