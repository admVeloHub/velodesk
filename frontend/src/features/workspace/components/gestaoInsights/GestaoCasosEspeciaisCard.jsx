/**
 * GestaoCasosEspeciaisCard v1.0.0 — casos especiais (Bacen/Procon/Consumidor.gov/Reclame Aqui)
 * DATE: 2026-07-17 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import GestaoPeriodFilter from './GestaoPeriodFilter';
import './gestaoInsights.css';

const ORGAO_ACCENTS = {
  bacen: { color: '#000058', icon: 'ti-building-bank' },
  procon: { color: '#1634FF', icon: 'ti-scale' },
  consumidorGov: { color: '#006AB9', icon: 'ti-gavel' },
  reclameAqui: { color: '#FCC200', icon: 'ti-message-report' },
};

export default function GestaoCasosEspeciaisCard() {
  const [period, setPeriod] = useState({ period: 'mes' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .casosEspeciais({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os casos especiais.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

  const items = data?.items ?? [];

  return (
    <section className="ws-panel gestao-insight-card gestao-casos-especiais-card">
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-alert-triangle" />
          </span>
          Casos especiais
        </h4>
        <GestaoPeriodFilter value={period} onChange={setPeriod} idPrefix="gestao-casos" />
      </header>

      <p className="gestao-insight-card__mock-note">
        <i className="ti ti-info-circle" aria-hidden="true" />
        Dados ilustrativos — aguardando integração dos canais de atendimento especiais.
      </p>

      {error ? <p className="gestao-insight-card__error">{error}</p> : null}

      {loading ? (
        <p className="gestao-insight-card__loading">Carregando…</p>
      ) : (
        <div className="gestao-casos-especiais-card__grid">
          {items.map((item) => {
            const accent = ORGAO_ACCENTS[item.id] ?? { color: '#1634FF', icon: 'ti-flag' };
            return (
              <div
                key={item.id}
                className="gestao-casos-especiais-card__tile"
                style={{ '--tile-accent': accent.color }}
              >
                <span className="gestao-casos-especiais-card__tile-icon" aria-hidden="true">
                  <i className={`ti ${accent.icon}`} />
                </span>
                <span className="gestao-casos-especiais-card__tile-value">{item.total}</span>
                <span className="gestao-casos-especiais-card__tile-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
