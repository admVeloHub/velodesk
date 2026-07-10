/**
 * DeskInternalNotesPanel v1.5.0 — Realizado por por evento (registro.autor)
 * VERSION: v1.5.0 | DATE: 2026-07-07
 */
import React, { useMemo } from 'react';
import {
  buildClientInternalNotesFeed,
  formatRegistroOccurrenceTimestamp,
} from '../../../services/desk/utils';

const KIND_META = {
  registro: { icon: 'ti ti-history' },
};

function isSameTicketNote(note, ticket) {
  const noteId = String(note.ticketId ?? '');
  return noteId === String(ticket?.id ?? '') || noteId === String(ticket?._id ?? '');
}

function formatTabulationChange(item) {
  if (item.previousValue) {
    return `${item.field}: ${item.previousValue} → ${item.value}`;
  }
  return `${item.field}: ${item.value}`;
}

function RegistroOccurrenceBody({ note }) {
  return (
    <div className="crm-note-card__registro-body">
      <p className="crm-note-card__inline-line">
        <span className="crm-note-card__body-label">Realizado por:</span>{' '}
        <span>{note.author}</span>
      </p>
      {note.internalExcerpt ? (
        <div className="crm-note-card__registro-block">
          <span className="crm-note-card__body-label">Anotação interna:</span>
          <p className="crm-note-card__body">{note.internalExcerpt}</p>
        </div>
      ) : null}
      {note.tabulationChanges?.length ? (
        <div className="crm-note-card__registro-block">
          <span className="crm-note-card__body-label">Alterações</span>
          <ul className="crm-note-card__changes">
            {note.tabulationChanges.map((item) => (
              <li key={`${item.field}-${item.previousValue || ''}-${item.value}`}>
                {formatTabulationChange(item)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {note.statusChanged && note.statusLabel ? (
        <p className="crm-note-card__inline-line crm-note-card__status-line">
          <span className="crm-note-card__body-label">Status:</span>{' '}
          <span>
            {note.previousStatusLabel
              ? `${note.previousStatusLabel} → ${note.statusLabel}`
              : note.statusLabel}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function NoteAvatar({ note }) {
  const meta = KIND_META[note.kind] || KIND_META.registro;
  return (
    <span className="crm-note-card__avatar crm-note-card__avatar--icon" aria-hidden="true">
      <i className={meta.icon} />
    </span>
  );
}

export default function DeskInternalNotesPanel({ ticket, client }) {
  const notes = useMemo(
    () => buildClientInternalNotesFeed(ticket, client),
    [ticket, client],
  );

  if (!notes.length) {
    return (
      <div className="crm-internal-notes crm-internal-notes--empty">
        <p>Nenhuma anotação ou alteração registrada neste ticket.</p>
      </div>
    );
  }

  return (
    <div className="crm-internal-notes">
      {notes.map((note, index) => (
        <React.Fragment key={note.id}>
          {index > 0 ? <hr className="crm-note-card__divider" aria-hidden="true" /> : null}
          <article className={`crm-note-card crm-note-card--${note.kind}`}>
            <div className="crm-note-card__accent" aria-hidden="true" />
            <div className="crm-note-card__inner">
              <header className="crm-note-card__head">
                <div className="crm-note-card__head-left">
                  <NoteAvatar note={note} />
                  <div className="crm-note-card__meta">
                    <strong className="crm-note-card__author">{note.badge}</strong>
                  </div>
                </div>
                <time className="crm-note-card__time" dateTime={note.timestamp}>
                  {formatRegistroOccurrenceTimestamp(note.timestamp)}
                </time>
              </header>
              {note.ticketTitle && !isSameTicketNote(note, ticket) ? (
                <p className="crm-note-card__ticket-ref">
                  Ticket #{note.ticketId} · {note.ticketTitle}
                </p>
              ) : null}
              <RegistroOccurrenceBody note={note} />
            </div>
          </article>
        </React.Fragment>
      ))}
    </div>
  );
}
