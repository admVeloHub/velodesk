/**
 * AiUsageCostCard v2.0.0 — tile compacto de custo de IA (mês/ano), gateway para a página de detalhe
 * DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiUsageApi } from '../../../../api/client';
import './aiUsage.css';

function formatUsd(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AiUsageCostCard() {
  const navigate = useNavigate();
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    aiUsageApi
      .totals()
      .then((result) => {
        if (active) setTotals(result);
      })
      .catch(() => {
        if (active) setTotals(null);
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
      onClick={() => navigate('/workspace/gestao/custo-ia')}
    >
      <header className="gestao-insight-card__head gestao-insight-card__head--compact">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-cpu" />
          </span>
          Custo de IA
        </h4>
        <i className="ti ti-chevron-right ai-usage-card__compact-chevron" aria-hidden="true" />
      </header>

      <div className="ai-usage-card__tiles ai-usage-card__tiles--compact">
        <div className="ai-usage-card__tile">
          <span className="ai-usage-card__tile-value">{loading ? '—' : formatUsd(totals?.currentMonth)}</span>
          <span className="ai-usage-card__tile-label">Mês atual</span>
        </div>
        <div className="ai-usage-card__tile ai-usage-card__tile--forecast">
          <span className="ai-usage-card__tile-value">{loading ? '—' : formatUsd(totals?.currentYear)}</span>
          <span className="ai-usage-card__tile-label">Ano atual</span>
        </div>
      </div>
    </button>
  );
}
