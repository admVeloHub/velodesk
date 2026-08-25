/**
 * GestaoCsatCard v1.0.0 — tile compacto de CSAT (nota média + respostas), gateway pra página de detalhe
 * DATE: 2026-08-25 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gestaoInsightsApi } from '../../../../api/client';
import '../aiUsage/aiUsage.css';

function formatNota(value) {
  return value == null ? '—' : Number(value).toFixed(1);
}

export default function GestaoCsatCard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gestaoInsightsApi
      .csat({ period: 'mes' })
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

  return (
    <button
      type="button"
      className="ws-panel gestao-insight-card ai-usage-card ai-usage-card--compact"
      onClick={() => navigate('/workspace/gestao/csat')}
    >
      <header className="gestao-insight-card__head gestao-insight-card__head--compact">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-star" />
          </span>
          CSAT
        </h4>
        <i className="ti ti-chevron-right ai-usage-card__compact-chevron" aria-hidden="true" />
      </header>

      <div className="ai-usage-card__tiles ai-usage-card__tiles--compact">
        <div className="ai-usage-card__tile">
          <span className="ai-usage-card__tile-value">{loading ? '—' : formatNota(data?.notaMedia)}</span>
          <span className="ai-usage-card__tile-label">Nota média (mês)</span>
        </div>
        <div className="ai-usage-card__tile ai-usage-card__tile--forecast">
          <span className="ai-usage-card__tile-value">{loading ? '—' : (data?.totalRespostas ?? 0)}</span>
          <span className="ai-usage-card__tile-label">Respostas</span>
        </div>
      </div>
    </button>
  );
}
