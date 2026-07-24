import React from 'react';

export default function Workspace360Kpis({
  kpis,
  gridAppend = null,
  gridAppendInline = false,
  ariaLabel = 'Meu dia',
  title = 'Meu dia',
}) {
  const useExtendedGrid = gridAppend && !gridAppendInline;
  return (
    <section className="ws360-kpis" aria-label={ariaLabel}>
      <div className="ws360-kpis__head">
        <h3 className="ws360-kpis__title">
          <i className="ti ti-chart-bar" aria-hidden="true" /> {title}
        </h3>
      </div>
      <div className={`ws360-kpi-grid${useExtendedGrid ? ' ws360-kpi-grid--with-append' : ''}`}>
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
        {gridAppend}
      </div>
    </section>
  );
}
