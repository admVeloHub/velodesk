/**
 * useGestaoInsightsPainel v1.0.0 — um GET /gestao-insights/painel por período
 * VERSION: v1.0.0 | DATE: 2026-08-18
 */
import { useCallback, useEffect, useState } from 'react';
import { gestaoInsightsApi } from '../api/client';

export function useGestaoInsightsPainel(period) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await gestaoInsightsApi.painel({
        period: period?.period,
        from: period?.from,
        to: period?.to,
        granularity: 'dia',
      });
      setData(payload);
      return payload;
    } catch (err) {
      setError(err);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [period?.period, period?.from, period?.to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
