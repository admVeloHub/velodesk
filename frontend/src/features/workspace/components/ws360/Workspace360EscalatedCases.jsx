/**
 * Casos escalados em atraso — painel supervisor
 * VERSION: v3.0.0 | DATE: 2026-07-20
 */
import React, { useMemo, useState } from 'react';

export default function Workspace360EscalatedCases({
  escalated,
  onViewAll,
  onDismiss,
  onOpenTicket,
}) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const categories = escalated?.categories ?? [];
  const groups = escalated?.groups ?? [];
  const slaCriticalCount = escalated?.slaCriticalCount ?? 0;

  const overdueTickets = useMemo(() => {
    const flattened = groups.flatMap((group) =>
      (group.entries ?? [])
        .filter((entry) => entry.sla === 'critical')
        .map((entry) => ({ ...entry, areaLabel: group.label }))
    );
    flattened.sort((a, b) => (a.ticket?.slaRemaining ?? 0) - (b.ticket?.slaRemaining ?? 0));
    return flattened.slice(0, 10);
  }, [groups]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <section className="ws-panel ws360-escalated ws360-escalated--compact">
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
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ws360-escalated__sla-banner ws360-escalated__sla-banner--toggle"
        onClick={() => setExpanded((v) => !v)}
        disabled={!overdueTickets.length}
      >
        <i className="ti ti-clock" aria-hidden="true" />
        <span>{slaCriticalCount} casos já passaram do prazo crítico de SLA</span>
        {overdueTickets.length ? (
          <i className={`ti ti-chevron-${expanded ? 'up' : 'down'} ws360-escalated__sla-chevron`} aria-hidden="true" />
        ) : null}
      </button>

      {expanded ? (
        <ul className="ws360-escalated__overdue-list">
          {overdueTickets.map((entry) => (
            <li key={entry.ticket.id} className="ws360-escalated__overdue-item">
              <div className="ws360-escalated__overdue-info">
                <span className="ws360-escalated__overdue-area">{entry.areaLabel}</span>
                <strong>{entry.ticket.chamadoProtocolo || entry.ticket.title}</strong>
                <span>{entry.ticket.title}</span>
              </div>
              <button
                type="button"
                className="ws360-escalated__overdue-open"
                onClick={() => onOpenTicket?.(entry.ticket.id)}
              >
                Abrir
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
