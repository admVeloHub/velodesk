/**
 * ReclameAquiReportsView — relatórios e gráficos
 */
import React from 'react';

function BarChart({ title, data }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <section className="ra-reports__chart">
      <h3>{title}</h3>
      <ul className="ra-reports__bars">
        {Object.entries(data).map(([label, value]) => (
          <li key={label} className="ra-reports__bar-row">
            <span className="ra-reports__bar-label">{label}</span>
            <div className="ra-reports__bar-track">
              <div className="ra-reports__bar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <span className="ra-reports__bar-value">{value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReclameAquiReportsView({ series, kpis }) {
  return (
    <div className="ra-reports">
      <div className="ra-reports__summary">
        {kpis.slice(0, 4).map((kpi) => (
          <article key={kpi.id} className={`ra-kpi ra-kpi--${kpi.tone} ra-kpi--compact`}>
            <strong className="ra-kpi__value">{kpi.value}</strong>
            <span className="ra-kpi__label">{kpi.label}</span>
          </article>
        ))}
      </div>

      <div className="ra-reports__charts">
        <BarChart title="Distribuição por status RA" data={series.byStatus} />
        <BarChart title="SLA das reclamações" data={series.slaBuckets} />
      </div>

      <section className="ra-reports__chart">
        <h3>Notas recebidas</h3>
        <ul className="ra-reports__bars">
          {series.notaDistrib.map(({ label, value }) => (
            <li key={label} className="ra-reports__bar-row">
              <span className="ra-reports__bar-label">{label}</span>
              <div className="ra-reports__bar-track">
                <div className="ra-reports__bar-fill ra-reports__bar-fill--success" style={{ width: `${value * 20}%` }} />
              </div>
              <span className="ra-reports__bar-value">{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
