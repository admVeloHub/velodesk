import React from 'react';

export default function Workspace360Kpis({ kpis }) {
  return (
    <section className="ws360-kpis" aria-label="Meu dia">
      <div className="ws360-kpis__head">
        <h3 className="ws360-kpis__title">
          <i className="ti ti-chart-bar" aria-hidden="true" /> Meu dia
        </h3>
      </div>
      <div className="ws360-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.id} className={`ws360-kpi ws360-kpi--${kpi.tone}`}>
            <div className="ws360-kpi__top">
              <i className={kpi.icon} aria-hidden="true" />
              {kpi.hint ? (
                <span className={`ws360-kpi__hint ws360-kpi__hint--${kpi.tone}`}>{kpi.hint}</span>
              ) : null}
            </div>
            <strong className="ws360-kpi__value">{kpi.value}</strong>
            <span className="ws360-kpi__label">{kpi.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
