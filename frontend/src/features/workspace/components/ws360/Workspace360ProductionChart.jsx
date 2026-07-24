/**
 * Workspace360ProductionChart v1.1.0 — produção semanal + total do período
 */
import React from 'react';

export default function Workspace360ProductionChart({ days }) {
  if (!days?.length) return null;

  const total = days.reduce((sum, day) => sum + (Number(day.value) || 0), 0);

  return (
    <section className="ws360-section ws360-production" aria-label="Minha produção — últimos 7 dias">
      <div className="ws360-production__head">
        <div className="ws360-production__head-main">
          <h3 className="ws360-production__title">Minha produção — últimos 7 dias</h3>
          <span className="ws360-production__subtitle">tickets resolvidos</span>
        </div>
        <div className="ws360-production__total-col" aria-label="Total do período">
          <span className="ws360-production__total-label">Total</span>
          <span className="ws360-production__total-value">{total}</span>
        </div>
      </div>
      <ul className="ws360-production__list">
        {days.map((day) => (
          <li
            key={day.id}
            className={`ws360-production__row${day.isToday ? ' ws360-production__row--today' : ''}`}
          >
            <span className="ws360-production__label">{day.label}</span>
            <div className="ws360-production__bar-track" aria-hidden="true">
              <div
                className="ws360-production__bar-fill"
                style={{ width: `${day.pct}%` }}
              />
            </div>
            <span className="ws360-production__value">{day.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
