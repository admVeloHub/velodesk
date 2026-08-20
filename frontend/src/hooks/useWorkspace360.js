/**
 * useWorkspace360 v1.4.1 — poll silencioso aplica payload mesmo se fingerprint falhar
 * VERSION: v1.4.1 | DATE: 2026-08-20
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { usePermissions } from '../context/PermissionContext';
import {
  fetchWorkspace360,
  fingerprintWorkspace360Payload,
  WORKSPACE360_POLL_MS,
} from '../services/workspace/workspace360Api';
import { subscribeToTicketEvents } from '../services/desk/ticketEventsRealtime';

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
  const {
    enabled = true,
    reportParams,
    poll = true,
    pollIntervalMs = WORKSPACE360_POLL_MS,
    onPollTick,
  } = options;
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
  const dataRef = useRef(null);
  const silentInFlightRef = useRef(false);
  const onPollTickRef = useRef(onPollTick);

  useEffect(() => {
    onPollTickRef.current = onPollTick;
  }, [onPollTick]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const applyPayload = useCallback((payload) => {
    try {
      const fp = fingerprintWorkspace360Payload(payload);
      const prevFp = fingerprintWorkspace360Payload(dataRef.current);
      if (fp !== prevFp) {
        dataRef.current = payload;
        setData(payload);
        return true;
      }
      return false;
    } catch {
      dataRef.current = payload;
      setData(payload);
      return true;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!fetchEnabled) return null;
    setLoading(true);
    setError(null);
    try {
      const params = buildQueryParams(profileId, canSeeEquipe, reportParams);
      const payload = await fetchWorkspace360(params);
      dataRef.current = payload;
      setData(payload);
      return payload;
    } catch (err) {
      setError(err);
      setData(null);
      dataRef.current = null;
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchEnabled, profileId, canSeeEquipe, reportParams]);

  const refreshSilent = useCallback(async () => {
    if (!fetchEnabled || silentInFlightRef.current) return null;
    silentInFlightRef.current = true;
    try {
      const params = buildQueryParams(profileId, canSeeEquipe, reportParams);
      const payload = await fetchWorkspace360(params);
      const changed = applyPayload(payload);
      if (typeof onPollTickRef.current === 'function') {
        await onPollTickRef.current({ changed, payload });
      }
      return payload;
    } catch {
      return null;
    } finally {
      silentInFlightRef.current = false;
    }
  }, [fetchEnabled, profileId, canSeeEquipe, reportParams, applyPayload]);

  useEffect(() => {
    if (!fetchEnabled) return;
    refresh();
  }, [fetchEnabled, refresh]);

  useEffect(() => {
    if (!fetchEnabled || !poll) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled || document.hidden) return;
      await refreshSilent();
    };

    const schedule = () => {
      timer = window.setTimeout(() => {
        void tick().finally(() => {
          if (!cancelled) schedule();
        });
      }, pollIntervalMs);
    };

    schedule();

    const onVisibilityChange = () => {
      if (!document.hidden) void refreshSilent();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const unsubscribeEvents = subscribeToTicketEvents(() => {
      if (!cancelled) void refreshSilent();
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeEvents();
    };
  }, [fetchEnabled, poll, pollIntervalMs, refreshSilent]);

  return {
    data,
    loading: loading || permissionsLoading,
    error,
    refresh,
    refreshSilent,
  };
}
