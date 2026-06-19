import React from 'react';

export default function Workspace360ProductionChart({ days }) {
  if (!days?.length) return null;

  return (
    <section className="ws360-section ws360-production" aria-label="Minha produção — últimos 7 dias">
      <div className="ws360-production__head">
        <h3 className="ws360-production__title">Minha produção — últimos 7 dias</h3>
        <span className="ws360-production__subtitle">tickets resolvidos</span>
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
