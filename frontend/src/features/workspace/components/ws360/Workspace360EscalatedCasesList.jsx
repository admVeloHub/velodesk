/**
 * Lista completa — casos escalados em atraso
 * VERSION: v2.0.0 | DATE: 2026-07-06
 */
import React from 'react';
import Workspace360TicketRow from './Workspace360TicketRow';

export default function Workspace360EscalatedCasesList({
  groups = [],
  slaCriticalCount = 0,
  onBack,
  onOpenTicket,
}) {
  const total = groups.reduce((sum, g) => sum + (g.tickets?.length ?? 0), 0);

  return (
    <section className="ws-panel ws360-escalated-list">
      <header className="ws360-escalated-list__head">
        <button type="button" className="ws360-escalated-list__back" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Voltar ao painel
        </button>
        <div className="ws360-escalated-list__title-wrap">
          <h4 className="ws360-escalated-list__title">Casos escalados em atraso</h4>
          <p className="ws360-escalated-list__subtitle">
            {total} tickets · {slaCriticalCount} com SLA crítico
          </p>
        </div>
      </header>

      {groups.map((group) => (
        <div key={group.id} className="ws360-escalated-list__group">
          <div className={'ws360-escalated-list__group-head ws360-escalated-list__group-head--' + group.accent}>
            <span className="ws360-escalated-list__group-label">{group.label}</span>
            <span className="ws360-escalated-list__group-count">{group.tickets?.length ?? 0} casos</span>
          </div>
          <div className="ws360-escalated-list__rows">
            {(group.tickets ?? []).map((ticket) => (
              <Workspace360TicketRow key={ticket.id} ticket={ticket} onOpen={onOpenTicket} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
