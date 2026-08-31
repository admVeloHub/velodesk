/**
 * DeskNoteCardParts v1.2.0 — evento de CSAT usa icone de estrela
 * VERSION: v1.2.0 | DATE: 2026-08-25
 */
import React from 'react';
import { htmlToPlainText, normalizeMessageHtmlForDisplay } from '../../../services/desk/composeRichEditor';

export const NOTE_KIND_META = {
  agent: { icon: null, useInitials: true },
  ai: { icon: 'ti ti-sparkles' },
  system: { icon: 'ti ti-terminal-2' },
  sla: { icon: 'ti ti-alert-triangle' },
  registro: { icon: 'ti ti-history' },
  workflow: { icon: 'ti ti-message-question' },
  'mensagem-enviada': { icon: 'ti ti-send' },
  'mensagem-recebida': { icon: 'ti ti-mail' },
};

export function isSameTicketNote(note, ticket) {
  const noteId = String(note.ticketId ?? '');
  return noteId === String(ticket?.id ?? '') || noteId === String(ticket?._id ?? '');
}

export function NoteBody({ body, boldSegments }) {
  const raw = String(body || '');
  if (!boldSegments?.length && /<[a-z][\s\S]*>/i.test(raw)) {
    const html = normalizeMessageHtmlForDisplay(raw);
    if (html) {
      return (
        <div
          className="crm-note-card__body crm-note-card__body--html"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    const plain = htmlToPlainText(raw).trim();
    if (!plain) return null;
    return <p className="crm-note-card__body">{plain}</p>;
  }

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

export function formatTabulationChange(item) {
  if (item.previousValue) {
    return `${item.field}: ${item.previousValue} → ${item.value}`;
  }
  return `${item.field}: ${item.value}`;
}

export function RegistroOccurrenceBody({ note }) {
  return (
    <div className="crm-note-card__registro-body">
      <p className="crm-note-card__inline-line">
        <span className="crm-note-card__body-label">Realizado por:</span>{' '}
        <span>{note.author}</span>
      </p>
      {note.csatNota != null ? (
        <p className="crm-note-card__inline-line">
          <span className="crm-note-card__body-label">Avaliação CSAT:</span>{' '}
          <span>nota {note.csatNota}/5 — comentário na aba Notas</span>
        </p>
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

export function MessageEventBody({ note }) {
  const isReceived = note.kind === 'mensagem-recebida';
  return (
    <div className="crm-note-card__registro-body">
      <p className="crm-note-card__inline-line">
        <span className="crm-note-card__body-label">
          {isReceived ? 'Recebido de:' : 'Enviado por:'}
        </span>{' '}
        <span>{note.author}</span>
      </p>
      <div className="crm-note-card__registro-block">
        <span className="crm-note-card__body-label">Mensagem:</span>
        <p className="crm-note-card__body crm-note-card__body--message">{note.body}</p>
      </div>
      {note.attachments?.length ? (
        <p className="crm-note-card__inline-line">
          <span className="crm-note-card__body-label">Anexos:</span>{' '}
          <span>{note.attachments.length}</span>
        </p>
      ) : null}
    </div>
  );
}

export function NoteAvatar({ note }) {
  const meta = NOTE_KIND_META[note.kind] || NOTE_KIND_META.agent;
  if (meta.useInitials) {
    return (
      <span className="crm-note-card__avatar" aria-hidden="true">
        {String(note.initials || note.author || '??').slice(0, 2).toUpperCase()}
      </span>
    );
  }
  // Evento de recebimento de CSAT: mesmo ícone de estrela do KPI no Painel 360
  // (ws360-kpi__top .ti-star), em vez do ícone genérico do tipo "registro".
  const icon = note.isCsatEvent ? 'ti ti-star' : meta.icon;
  return (
    <span className="crm-note-card__avatar crm-note-card__avatar--icon" aria-hidden="true">
      <i className={icon} />
    </span>
  );
}
