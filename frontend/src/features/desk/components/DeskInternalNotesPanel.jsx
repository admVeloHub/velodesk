/**
 * DeskInternalNotesPanel v1.4.1 — histórico de alterações por capacidade (não só profileId gestao)
 * VERSION: v1.4.1 | DATE: 2026-07-27
 */
import React, { useMemo, useEffect, useState } from 'react';
import {
  buildClientInternalNotesFeed,
  formatInternalNoteTimestamp,
  formatRegistroOccurrenceTimestamp,
} from '../../../services/desk/utils';
import { useProfile } from '../../../context/ProfileContext';
import { shouldViewAllDeskTickets } from '../../../services/desk/responsavelSegmentation';

const KIND_META = {
  agent: { icon: null, useInitials: true },
  ai: { icon: 'ti ti-sparkles' },
  system: { icon: 'ti ti-terminal-2' },
  sla: { icon: 'ti ti-alert-triangle' },
  registro: { icon: 'ti ti-history' },
  workflow: { icon: 'ti ti-message-question' },
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
  // Gestão/supervisor/ver_todos: feed completo — mesmo se o portal ativo for "agent" (RBAC).
  const supervisorView = shouldViewAllDeskTickets(profileId) || profileId === 'gestao';
  const [infoRevision, setInfoRevision] = useState(0);

  useEffect(() => {
    const onInfoChanged = () => setInfoRevision((value) => value + 1);
    window.addEventListener('velodesk:workflow-info-changed', onInfoChanged);
    return () => window.removeEventListener('velodesk:workflow-info-changed', onInfoChanged);
  }, []);

  const notes = useMemo(
    () => buildClientInternalNotesFeed(ticket, client, { supervisorView }),
    [ticket, client, supervisorView, infoRevision],
  );

  if (!notes.length) {
    return (
      <div className="crm-internal-notes crm-internal-notes--empty">
        <p>{supervisorView ? 'Nenhuma anotação ou alteração de agente registrada.' : 'Nenhuma nota interna ou alteração registrada.'}</p>
      </div>
    );
  }

  return (
    <div className="crm-internal-notes">
      {notes.map((note, index) => {
        const isRegistro = note.kind === 'registro';
        const timestampLabel = isRegistro
          ? formatRegistroOccurrenceTimestamp(note.timestamp)
          : formatInternalNoteTimestamp(note.timestamp);
        return (
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
                      {!supervisorView && !isRegistro ? (
                        <span className={`crm-note-card__badge crm-note-card__badge--${note.kind}`}>
                          {note.author}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <time className="crm-note-card__time" dateTime={note.timestamp}>
                    {timestampLabel}
                  </time>
                </header>
                {!supervisorView && !isRegistro && note.ticketTitle && !isSameTicketNote(note, ticket) ? (
                  <p className="crm-note-card__ticket-ref">
                    Ticket #{note.ticketId} · {note.ticketTitle}
                  </p>
                ) : null}
                {isRegistro ? (
                  <RegistroOccurrenceBody note={note} />
                ) : (
                  <NoteBody body={note.body} boldSegments={note.boldSegments} />
                )}
                {!supervisorView && !isRegistro && note.tags?.length ? (
                  <div className="crm-note-card__tags">
                    {note.tags.map((tag) => (
                      <span key={tag} className="crm-note-card__tag">{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          </React.Fragment>
        );
      })}
    </div>
  );
}
