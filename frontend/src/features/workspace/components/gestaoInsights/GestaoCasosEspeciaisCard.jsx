/**
 * GestaoCasosEspeciaisCard v2.1.0 — tiles compactos; suporta slice do GET /gestao-insights/painel
 * VERSION: v2.1.0 | DATE: 2026-08-18
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gestaoInsightsApi } from '../../../../api/client';
import { getGestaoOrgaoTheme } from '../../../../config/especiaisTheme';
import './gestaoInsights.css';

const ORGAO_ICONS = {
  bacen: 'ti-building-bank',
  procon: 'ti-scale',
  consumidorGov: 'ti-gavel',
  reclameAqui: 'ti-message-report',
};

export default function GestaoCasosEspeciaisCard({ painelData, painelLoading }) {
  const navigate = useNavigate();
  const managedByPainel = painelData !== undefined || painelLoading !== undefined;
  const [localData, setLocalData] = useState(null);
  const [localLoading, setLocalLoading] = useState(!managedByPainel);

  useEffect(() => {
    if (managedByPainel) return undefined;
    let active = true;
    setLocalLoading(true);
    gestaoInsightsApi
      .casosEspeciais({ period: 'mes' })
      .then((result) => {
        if (active) setLocalData(result);
      })
      .catch(() => {
        if (active) setLocalData(null);
      })
      .finally(() => {
        if (active) setLocalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [managedByPainel]);

  const data = managedByPainel ? painelData : localData;
  const loading = managedByPainel ? Boolean(painelLoading) : localLoading;
  const items = data?.items ?? [];

  return (
    <section className="ws-panel gestao-insight-card gestao-casos-especiais-card gestao-casos-especiais-card--compact">
      <header className="gestao-insight-card__head gestao-insight-card__head--compact">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-alert-triangle" />
          </span>
          Casos especiais · mês
        </h4>
      </header>

      <div className="gestao-casos-especiais-card__grid gestao-casos-especiais-card__grid--compact">
        {(loading ? Array.from({ length: 4 }) : items).map((item, idx) => {
          const key = item?.id ?? `placeholder-${idx}`;
          const accent = item?.id
            ? { color: getGestaoOrgaoTheme(item.id).accent, icon: ORGAO_ICONS[item.id] ?? 'ti-flag' }
            : { color: '#1634FF', icon: 'ti-flag' };
          return (
            <button
              key={key}
              type="button"
              className="gestao-casos-especiais-card__tile gestao-casos-especiais-card__tile--link"
              style={{ '--tile-accent': accent.color }}
              disabled={!item}
              onClick={() => item && navigate(`/workspace/gestao/casos-especiais/${item.id}`)}
            >
              <span className="gestao-casos-especiais-card__tile-icon" aria-hidden="true">
                <i className={`ti ${accent.icon}`} />
              </span>
              <span className="gestao-casos-especiais-card__tile-value">{loading ? '—' : item.total}</span>
              <span className="gestao-casos-especiais-card__tile-label">
                {item?.label ?? ''}
                {!loading && item?.mock === false ? (
                  <small className="gestao-casos-especiais-card__tile-real">dados reais</small>
                ) : null}
              </span>
              <i className="ti ti-chevron-right gestao-casos-especiais-card__tile-chevron" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
