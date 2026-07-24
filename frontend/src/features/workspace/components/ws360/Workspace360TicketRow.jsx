import React from 'react';

export default function Workspace360TicketRow({ ticket, onOpen }) {
  return (
    <button
      type="button"
      className={`ws360-ticket-row ws360-ticket-row--${ticket.accent}${ticket.unread ? ' ws360-ticket-row--unread' : ''}`}
      onClick={() => onOpen?.(ticket.id)}
      disabled={!onOpen}
    >
      <span className="ws360-ticket-row__avatar" aria-hidden="true">
        {ticket.initials}
      </span>
      <span className="ws360-ticket-row__body">
        <span className="ws360-ticket-row__top">
          <strong className="ws360-ticket-row__name">{ticket.clientName}</strong>
          <span className={`ws360-badge ws360-badge--${ticket.badge.tone}`}>{ticket.badge.text}</span>
          {ticket.unread ? <span className="ws360-ticket-row__dot" aria-label="Não lido" /> : null}
        </span>
        <span className="ws360-ticket-row__subject">{ticket.subject}</span>
        <span className="ws360-ticket-row__meta">
          <i className={ticket.channelIcon} aria-hidden="true" /> {ticket.meta}
        </span>
      </span>
      <span className="ws360-ticket-row__aside">
        <span className={`ws360-sla ws360-sla--${ticket.slaTone}`}>{ticket.slaLabel}</span>
        <span className="ws360-tags">
          {ticket.tags.map((tag) => (
            <span key={tag} className="ws360-tag">
              {tag}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
