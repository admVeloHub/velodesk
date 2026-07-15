/**
 * KPIs do painel Supervisor — grid 12 colunas (bordas alinhadas ao hero)
 * VERSION: v1.3.0 | DATE: 2026-07-06
 */
import React from 'react';

export default function Workspace360SupervisorKpis({ kpis, statusSlot = null }) {
  const primary = [
    { value: `${kpis.slaPct ?? 0}%`, label: 'SLA cumprido' },
    { value: String(kpis.slaRisk ?? 0), label: 'Em risco de SLA' },
    { value: kpis.online == null ? '—' : String(kpis.online), label: 'Agentes online' },
  ];

  const secondary = [
    { value: kpis.tma, label: 'TMA', icon: 'fa-stopwatch' },
    { value: kpis.tme, label: 'TME', icon: 'fa-hourglass-half' },
    { value: kpis.nps, label: 'NPS', icon: 'fa-smile' },
    { value: kpis.volume, label: 'Volume', icon: 'fa-phone-volume' },
  ];

  return (
    <div className={'ws360-super-kpis' + (statusSlot ? ' ws360-super-kpis--with-status' : '')}>
      {primary.map((item) => (
        <div key={item.label} className="ws360-super-kpi ws360-super-kpi--primary">
          <strong className="ws360-super-kpi__value">{item.value}</strong>
          <span className="ws360-super-kpi__label">{item.label}</span>
        </div>
      ))}
      {secondary.map((item) => (
        <div key={item.label} className="ws360-super-kpi ws360-super-kpi--secondary">
          <div className="ws-stat-card">
            <i className={'fas ' + item.icon} aria-hidden="true" />
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        </div>
      ))}
      {statusSlot}
    </div>
  );
}
