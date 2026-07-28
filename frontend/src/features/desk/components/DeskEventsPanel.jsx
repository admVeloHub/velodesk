/**
 * DeskEventsPanel v1.1.0 — timeline de registros/gatilhos e mensagens públicas
 * VERSION: v1.1.0 | DATE: 2026-07-28
 */
import React, { useMemo, useEffect, useState } from 'react';
import {
  buildTicketEventsFeed,
  formatRegistroOccurrenceTimestamp,
} from '../../../services/desk/utils';
import {
  MessageEventBody,
  NoteAvatar,
  RegistroOccurrenceBody,
} from './DeskNoteCardParts';

function renderEventBody(note) {
  if (note.kind === 'registro') {
    return <RegistroOccurrenceBody note={note} />;
  }
  if (note.kind === 'mensagem-enviada' || note.kind === 'mensagem-recebida') {
    return <MessageEventBody note={note} />;
  }
  return null;
}

export default function DeskEventsPanel({ ticket, client }) {
  const [infoRevision, setInfoRevision] = useState(0);
  const ticketId = String(ticket?.id || ticket?._id || '');
  const historicoLen = ticket?.registroHistorico?.length ?? 0;
  const messagesLen = ticket?.messages?.length ?? 0;
  const ticketUpdatedAt = ticket?.updatedAt;

  useEffect(() => {
    const bump = () => setInfoRevision((value) => value + 1);
    window.addEventListener('velodesk:workflow-info-changed', bump);
    window.addEventListener('velodesk:ticket-detail-changed', bump);
    return () => {
      window.removeEventListener('velodesk:workflow-info-changed', bump);
      window.removeEventListener('velodesk:ticket-detail-changed', bump);
    };
  }, []);

  const events = useMemo(
    () => buildTicketEventsFeed(ticket, client),
    [ticket, client, infoRevision, historicoLen, messagesLen, ticketUpdatedAt],
  );

  if (!events.length) {
    return (
      <div className="crm-internal-notes crm-internal-notes--empty">
        <p>Nenhum evento registrado neste ticket.</p>
      </div>
    );
  }

  return (
    <div className="crm-internal-notes" data-ticket-id={ticketId || undefined}>
      {events.map((event, index) => (
        <React.Fragment key={event.id}>
          {index > 0 ? <hr className="crm-note-card__divider" aria-hidden="true" /> : null}
          <article className={`crm-note-card crm-note-card--${event.kind}`}>
            <div className="crm-note-card__accent" aria-hidden="true" />
            <div className="crm-note-card__inner">
              <header className="crm-note-card__head">
                <div className="crm-note-card__head-left">
                  <NoteAvatar note={event} />
                  <div className="crm-note-card__meta">
                    <strong className="crm-note-card__author">{event.badge}</strong>
                  </div>
                </div>
                <time className="crm-note-card__time" dateTime={event.timestamp}>
                  {formatRegistroOccurrenceTimestamp(event.timestamp)}
                </time>
              </header>
              {renderEventBody(event)}
            </div>
          </article>
        </React.Fragment>
      ))}
    </div>
  );
}
