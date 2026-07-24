/**
 * GestaoMotivosCard v1.0.0 — top motivos de acionamento por produto (consolidado da tabulação)
 * DATE: 2026-07-17 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import './gestaoInsights.css';

export default function GestaoMotivosCard({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .motivos({ period: period.period, from: period.from, to: period.to, limit: 10 })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os motivos de acionamento.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

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
