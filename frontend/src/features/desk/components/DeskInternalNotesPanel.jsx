/**
 * DeskInternalNotesPanel v1.3.4 — status sempre visível no registro
 * VERSION: v1.3.4 | DATE: 2026-07-02
 */
import React, { useMemo } from 'react';
import {
  buildClientInternalNotesFeed,
  formatInternalNoteTimestamp,
  formatRegistroOccurrenceTimestamp,
} from '../../../services/desk/utils';
import { useProfile } from '../../../context/ProfileContext';

const KIND_META = {
  agent: { icon: null, useInitials: true },
  ai: { icon: 'ti ti-sparkles' },
  system: { icon: 'ti ti-terminal-2' },
  sla: { icon: 'ti ti-alert-triangle' },
  registro: { icon: 'ti ti-history' },
};

function isSameTicketNote(note, ticket) {
  const noteId = String(note.ticketId ?? '');
  return noteId === String(ticket?.id ?? '') || noteId === String(ticket?._id ?? '');
}

function NoteBody({ body, boldSegments }) {
  if (!boldSegments?.length) {
    return <p className="crm-note-card__body">{body}</p>;
  }

  let segments = [body];
  boldSegments.forEach((bold) => {
    segments = segments.flatMap((part, partIdx) => {
      if (typeof part !== 'string') return [part];
      return part.split(bold).flatMap((chunk, idx, arr) => {
        const items = [chunk];
        if (idx < arr.length - 1) {
          items.push(<strong key={`${bold}-${partIdx}-${idx}`}>{bold}</strong>);
        }
        return items;
      });
    });
  });

  return <p className="crm-note-card__body">{segments}</p>;
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
          <span className="crm-note-card__body-label">Anotações:</span>
          <p className="crm-note-card__body">{note.internalExcerpt}</p>
        </div>
      ) : null}
      {note.tabulationChanges?.length ? (
        <div className="crm-note-card__registro-block">
          <span className="crm-note-card__body-label">Alterações</span>
          <ul className="crm-note-card__changes">
            {note.tabulationChanges.map((item) => (
              <li key={`${item.field}-${item.value}`}>
                {item.field}: {item.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="crm-note-card__inline-line crm-note-card__status-line">
        <span className="crm-note-card__body-label">Status:</span>{' '}
        <span>{note.statusLabel || '—'}</span>
      </p>
    </div>
  );
}

function NoteAvatar({ note }) {
  const meta = KIND_META[note.kind] || KIND_META.agent;
  if (meta.useInitials) {
    return (
      <span className="crm-note-card__avatar" aria-hidden="true">
        {String(note.initials || note.author || '??').slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="crm-note-card__avatar crm-note-card__avatar--icon" aria-hidden="true">
      <i className={meta.icon} />
    </span>
  );
}

export default function DeskInternalNotesPanel({ ticket, client }) {
  const { profileId } = useProfile();
  const supervisorView = profileId === 'supervisor';
  const notes = useMemo(
    () => buildClientInternalNotesFeed(ticket, client, { supervisorView }),
    [ticket, client, supervisorView],
  );

  const formatTimestamp = supervisorView
    ? formatRegistroOccurrenceTimestamp
    : formatInternalNoteTimestamp;

  if (!notes.length) {
    return (
      <div className="crm-internal-notes crm-internal-notes--empty">
        <p>{supervisorView ? 'Nenhum registro no histórico.' : 'Nenhuma nota interna registrada.'}</p>
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
                    {!supervisorView ? (
                      <span className={`crm-note-card__badge crm-note-card__badge--${note.kind}`}>
                        {note.author}
                      </span>
                    ) : null}
                  </div>
                </div>
                <time className="crm-note-card__time" dateTime={note.timestamp}>
                  {formatTimestamp(note.timestamp)}
                </time>
              </header>
              {!supervisorView && note.ticketTitle && !isSameTicketNote(note, ticket) ? (
                <p className="crm-note-card__ticket-ref">
                  Ticket #{note.ticketId} · {note.ticketTitle}
                </p>
              ) : null}
              {supervisorView && note.kind === 'registro' ? (
                <RegistroOccurrenceBody note={note} />
              ) : (
                <NoteBody body={note.body} boldSegments={note.boldSegments} />
              )}
              {!supervisorView && note.tags?.length ? (
                <div className="crm-note-card__tags">
                  {note.tags.map((tag) => (
                    <span key={tag} className="crm-note-card__tag">{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </React.Fragment>
      ))}
    </div>
  );
}
