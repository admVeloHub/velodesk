/**
 * GestaoMotivosCard v1.1.0 — top motivos; suporta slice do GET /gestao-insights/painel
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import React, { useEffect, useMemo, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import './gestaoInsights.css';

export default function GestaoMotivosCard({ period, painelData, painelLoading }) {
  const managedByPainel = painelData !== undefined || painelLoading !== undefined;
  const [localData, setLocalData] = useState(null);
  const [localLoading, setLocalLoading] = useState(!managedByPainel);
  const [error, setError] = useState('');

  useEffect(() => {
    if (managedByPainel) return undefined;
    let active = true;
    setLocalLoading(true);
    setError('');
    gestaoInsightsApi
      .motivos({ period: period.period, from: period.from, to: period.to, limit: 10 })
      .then((result) => {
        if (active) setLocalData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os motivos de acionamento.');
      })
      .finally(() => {
        if (active) setLocalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to, managedByPainel]);

  const data = managedByPainel ? painelData : localData;
  const loading = managedByPainel ? Boolean(painelLoading) : localLoading;

  const items = data?.items ?? [];
  const maxCount = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.count), 1),
    [items],
  );

  return (
    <section className="ws-panel gestao-insight-card gestao-motivos-card">
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-list-details" />
          </span>
          Principais motivos de acionamento
        </h4>
      </header>

      {error ? <p className="gestao-insight-card__error">{error}</p> : null}

      {loading ? (
        <p className="gestao-insight-card__loading">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="gestao-insight-card__empty">Sem tabulações no período selecionado.</p>
      ) : (
        <ol className="gestao-motivos-card__list">
          {items.map((item, index) => (
            <li key={`${item.produto}-${item.motivo}`} className="gestao-motivos-card__item">
              <span className="gestao-motivos-card__rank">{index + 1}</span>
              <div className="gestao-motivos-card__body">
                <div className="gestao-motivos-card__labels">
                  <span className="gestao-motivos-card__produto">{item.produto}</span>
                  <span className="gestao-motivos-card__motivo">{item.motivo}</span>
                </div>
                <div className="gestao-motivos-card__bar-track">
                  <div
                    className="gestao-motivos-card__bar-fill"
                    style={{ width: `${Math.max(4, Math.round((item.count / maxCount) * 100))}%` }}
                  />
                </div>
              </div>
              <div className="gestao-motivos-card__stats">
                <strong>{item.pct}%</strong>
                <span>{item.count} tickets</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
