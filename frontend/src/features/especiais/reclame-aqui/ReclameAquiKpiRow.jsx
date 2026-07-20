/**
 * ReclameAquiKpiRow — 6 cards de métricas
 */
import React from 'react';

export default function ReclameAquiKpiRow({ kpis }) {
  if (!kpis?.length) return null;

  return (
    <div className="ra-kpi-row">
      {kpis.map((kpi) => (
        <article key={kpi.id} className={`ra-kpi ra-kpi--${kpi.tone}`}>
          <span className="ra-kpi__icon">
            <i className={`ti ${kpi.icon}`} aria-hidden="true" />
          </span>
          <strong className="ra-kpi__value">{kpi.value}</strong>
          <span className="ra-kpi__label">{kpi.label}</span>
        </article>
      ))}
    </div>
  );
}
