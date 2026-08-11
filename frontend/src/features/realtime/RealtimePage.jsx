/**
 * RealtimePage — painel operacional ao vivo (Gestão)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { realtimeApi } from '../../api/client';
import RealtimeDashboard from './RealtimeDashboard';
import './realtime.css';

const POLL_MS = 60_000;

export default function RealtimePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [refreshingIa, setRefreshingIa] = useState(false);
  const [iaRefreshMessage, setIaRefreshMessage] = useState(null);

  const refreshData = useCallback(async (withSync = false) => {
    setRefreshing(true);
    setError(null);
    try {
      if (withSync) {
        await Promise.all([
          realtimeApi.syncEvents().catch(() => null),
          realtimeApi.syncCalls().catch(() => null),
        ]);
      }
      const dashboard = await realtimeApi.dashboard();
      setData(dashboard);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Falha ao carregar Realtime');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshIaAnalysis = useCallback(async () => {
    setRefreshingIa(true);
    setIaRefreshMessage(null);
    try {
      const result = await realtimeApi.refreshIa();
      if (result?.skipped) {
        setIaRefreshMessage(result.reason || 'Ciclo de análise IA já em execução — aguarde terminar.');
      } else {
        setIaRefreshMessage(
          `Ciclo concluído: ${result?.classificados ?? 0} classificados de ${result?.candidatos ?? 0} candidatos.`
        );
        await refreshData(false);
      }
    } catch (err) {
      setIaRefreshMessage(err?.response?.data?.message || err?.message || 'Falha ao atualizar análise IA');
    } finally {
      setRefreshingIa(false);
    }
  }, [refreshData]);

  useEffect(() => {
    void refreshData(true);
    const poll = window.setInterval(() => {
      void refreshData(true);
    }, POLL_MS);
    return () => window.clearInterval(poll);
  }, [refreshData]);

  return (
    <div className="page active realtime-page" id="realtimePage">
      <div className="realtime-toolbar">
        <img src="/tipo_velotax_ajustada_cor.png" alt="Velotax" className="realtime-toolbar__logo" />
        <span className="realtime-toolbar__title">Realtime · Operação</span>
        <button
          type="button"
          className="realtime-toolbar__refresh"
          onClick={() => void refreshData(true)}
          disabled={refreshing}
          title="Atualizar 55PBX e dashboard"
          aria-label="Atualizar"
        >
          <i className={`ti ti-refresh${refreshing ? ' ti-spin' : ''}`} aria-hidden="true" />
        </button>
        <span className="realtime-toolbar__date">{data?.dateLabel ?? '—'}</span>
      </div>

      {loading && !data ? <div className="realtime-loading">Carregando painel…</div> : null}
      {error ? <div className="realtime-unavailable">{error}</div> : null}
      {data ? (
        <RealtimeDashboard
          data={data}
          onRefreshIa={refreshIaAnalysis}
          refreshingIa={refreshingIa}
          iaRefreshMessage={iaRefreshMessage}
        />
      ) : null}
    </div>
  );
}
