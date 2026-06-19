/**
 * DeskInternalNotesPanel v1.1.0 — feed de notas internas do histórico do cliente
 */
import React, { useMemo } from 'react';
import { buildClientInternalNotesFeed, formatInternalNoteTimestamp } from '../../../services/desk/utils';

const KIND_META = {
  agent: { icon: null, useInitials: true },
  ai: { icon: 'ti ti-sparkles' },
  system: { icon: 'ti ti-terminal-2' },
  sla: { icon: 'ti ti-alert-triangle' },
};

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

function NoteAvatar({ note }) {
  const meta = KIND_META[note.kind] || KIND_META.agent;
  if (meta.useInitials) {
    return (
      <span className="crm-note-card__avatar" aria-hidden="true">
        {note.initials || note.author.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <span className="crm-note-card__avatar crm-note-card__avatar--icon" aria-hidden="true">
      <i className={meta.icon} />
    </span>
  );
}

export default function DeskInternalNotesPanel({ ticket, client, onNotify }) {
  const notes = useMemo(() => buildClientInternalNotesFeed(ticket, client), [ticket, client]);

  if (!notes.length) {
    return (
      <div className="crm-internal-notes crm-internal-notes--empty">
        <p>Nenhuma nota interna registrada.</p>
      </div>
    );
  }

  return (
    <div className="crm-internal-notes">
      {notes.map((note) => (
        <article key={note.id} className={`crm-note-card crm-note-card--${note.kind}`}>
          <div className="crm-note-card__accent" aria-hidden="true" />
          <div className="crm-note-card__inner">
            <header className="crm-note-card__head">
              <div className="crm-note-card__head-left">
                <NoteAvatar note={note} />
                <div className="crm-note-card__meta">
                  <strong className="crm-note-card__author">{note.author}</strong>
                  <span className={`crm-note-card__badge crm-note-card__badge--${note.kind}`}>{note.badge}</span>
                </div>
              </div>
              <time className="crm-note-card__time" dateTime={note.timestamp}>
                {formatInternalNoteTimestamp(note.timestamp)}
              </time>
            </header>
            {note.ticketTitle && String(note.ticketId) !== String(ticket.id) ? (
              <p className="crm-note-card__ticket-ref">Ticket #{note.ticketId} · {note.ticketTitle}</p>
            ) : null}
            <NoteBody body={note.body} boldSegments={note.boldSegments} />
            {note.tags?.length ? (
              <div className="crm-note-card__tags">
                {note.tags.map((tag) => (
                  <span key={tag} className="crm-note-card__tag">{tag}</span>
                ))}
              </div>
            ) : null}
            {note.editable ? (
              <div className="crm-note-card__actions">
                <button
                  type="button"
                  className="crm-note-card__action"
                  onClick={() => onNotify?.('Edição de nota em breve.', 'info')}
                >
                  <i className="ti ti-pencil" aria-hidden="true" /> Editar
                </button>
                <button
                  type="button"
                  className="crm-note-card__action crm-note-card__action--danger"
                  onClick={() => onNotify?.('Exclusão de nota em breve.', 'info')}
                >
                  <i className="ti ti-trash" aria-hidden="true" /> Excluir
                </button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
