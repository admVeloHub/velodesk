/**
 * Casos escalados em atraso — painel supervisor
 * VERSION: v1.1.0 | DATE: 2026-06-19
 */
import React, { useState } from 'react';
import { ESCALATED_CASES_SUMMARY } from '../../../../services/workspace/escalatedCasesData';
import Workspace360ChannelVision from './Workspace360ChannelVision';

export default function Workspace360EscalatedCases({ onViewAll, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const { categories, slaCriticalCount, updatedLabel } = ESCALATED_CASES_SUMMARY;

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
            <p className="ws360-escalated__updated">{updatedLabel}</p>
          </div>
        </div>
        <button
          type="button"
          className="ws360-escalated__close"
          onClick={handleDismiss}
          aria-label="Fechar"
        >
          <i className="ti ti-x" />
        </button>
      </header>

      <p className="ws360-escalated__visibility">
        <i className="ti ti-eye" aria-hidden="true" />
        Visível apenas para supervisores
      </p>

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

      <div className="ws360-escalated__footer">
        <button type="button" className="ws360-escalated__btn ws360-escalated__btn--secondary" onClick={onViewAll}>
          Ver lista completa
        </button>
      </div>

      <Workspace360ChannelVision />
    </section>
  );
}
