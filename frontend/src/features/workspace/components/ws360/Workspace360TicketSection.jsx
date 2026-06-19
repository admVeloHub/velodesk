import React from 'react';
import Workspace360TicketRow from './Workspace360TicketRow';

export default function Workspace360TicketSection({ section, onOpenTicket, onSeeAll }) {
  return (
    <section className={`ws360-section ws360-section--${section.variant}`}>
      <div className="ws360-section__head">
        <h3 className="ws360-section__title">
          <i className={section.icon} aria-hidden="true" /> {section.title}
          <span className="ws360-section__count">{section.count}</span>
        </h3>
        <button type="button" className="ws360-link" onClick={() => onSeeAll(section.id)}>
          ver todos →
        </button>
      </div>
      <div className="ws360-section__list">
        {section.tickets.length === 0 ? (
          <p className="ws360-section__empty">Nenhum ticket nesta fila.</p>
        ) : (
          section.tickets.map((ticket) => (
            <Workspace360TicketRow key={ticket.id} ticket={ticket} onOpen={onOpenTicket} />
          ))
        )}
      </div>
    </section>
  );
}
