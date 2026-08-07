/**
 * GestaoCasosEspeciaisCard v2.0.0 — tiles compactos de casos especiais (Bacen/Procon/Consumidor.gov/Reclame Aqui)
 * Cada tile mostra o total do mês atual e é um gateway para a página de detalhe do órgão/canal.
 * DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
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

export default function GestaoCasosEspeciaisCard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gestaoInsightsApi
      .casosEspeciais({ period: 'mes' })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
              <span className="gestao-casos-especiais-card__tile-label">{item?.label ?? ''}</span>
              <i className="ti ti-chevron-right gestao-casos-especiais-card__tile-chevron" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
