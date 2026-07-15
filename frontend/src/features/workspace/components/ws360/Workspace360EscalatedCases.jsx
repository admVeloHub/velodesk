/**
 * Casos escalados em atraso — painel supervisor
 * VERSION: v2.2.0 | DATE: 2026-07-06
 */
import React, { useState } from 'react';

export default function Workspace360EscalatedCases({
  escalated,
  onViewAll,
  onDismiss,
}) {
  const [visible, setVisible] = useState(true);
  const categories = escalated?.categories ?? [];
  const slaCriticalCount = escalated?.slaCriticalCount ?? 0;

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <section className="ws-panel ws360-escalated">
      <header className="ws360-escalated__head">
        <div className="ws360-escalated__head-main">
          <span className="ws360-escalated__icon" aria-hidden="true">
            <i className="ti ti-alert-triangle" />
          </span>
          <div>
            <h4 className="ws360-escalated__title">Casos escalados em atraso</h4>
          </div>
        </div>
        <div className="ws360-escalated__head-actions">
          <button type="button" className="ws360-escalated__btn ws360-escalated__btn--secondary" onClick={onViewAll}>
            Ver lista completa
          </button>
          <button
            type="button"
            className="ws360-escalated__close"
            onClick={handleDismiss}
            aria-label="Fechar"
          >
            <i className="ti ti-x" />
          </button>
        </div>
      </header>

      <div className="ws360-escalated__cards">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className={'ws360-escalated-card ws360-escalated-card--' + cat.accent}
          >
            <span className="ws360-escalated-card__label">{cat.label}</span>
            <strong className="ws360-escalated-card__value">{cat.count}</strong>
            <span className="ws360-escalated-card__desc">casos parados em atraso</span>
          </div>
        ))}
      </div>

      <div className="ws360-escalated__sla-banner" role="status">
        <i className="ti ti-clock" aria-hidden="true" />
        <span>{slaCriticalCount} casos já passaram do prazo crítico de SLA</span>
      </div>
    </section>
  );
}
