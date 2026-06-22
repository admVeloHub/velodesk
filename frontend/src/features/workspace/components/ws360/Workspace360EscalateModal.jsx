/**
 * Modal de escalonamento de tickets — supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-22
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ESCALONAR_OPTIONS } from '../../../../services/desk/constants';
import { getEscalonarLabel } from '../../../../services/desk/utils';
import {
  escalateTicket,
  searchTicketsForEscalation,
} from '../../../../services/workspace/supervisorEscalateData';

const QUEUE_LABELS = {
  novos: 'Novos',
  'em-andamento': 'Em andamento',
  pendente: 'Pendente',
};

export default function Workspace360EscalateModal({ open, onClose, onComplete }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [escalonar, setEscalonar] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setResults([]);
    setSearched(false);
    setSelectedTicketId('');
    setEscalonar('');
    setSubmitting(false);
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedTicket = results.find((item) => item.id === selectedTicketId) || null;

  const handleSearch = (event) => {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setSelectedTicketId('');
      setEscalonar('');
      return;
    }
    const found = searchTicketsForEscalation(trimmed);
    setResults(found);
    setSearched(true);
    setSelectedTicketId(found.length === 1 ? found[0].id : '');
    setEscalonar('');
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicketId(ticket.id);
    setEscalonar(ticket.currentEscalonar || '');
  };

  const handleConfirm = async () => {
    if (!selectedTicketId || !escalonar) return;
    setSubmitting(true);
    try {
      await escalateTicket(selectedTicketId, escalonar);
      onComplete?.({
        ticketId: selectedTicketId,
        escalonar,
        label: getEscalonarLabel(escalonar),
        ticket: selectedTicket,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <>
      <button
        type="button"
        className="ws360-report-modal__backdrop"
        aria-label="Fechar escalonamento"
        onClick={onClose}
      />
      <div
        className="ws360-report-modal ws360-escalate-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws360EscalateModalTitle"
      >
        <header className="ws360-report-modal__header">
          <div className="ws360-report-modal__head-main">
            <span className="ws360-report-modal__icon" aria-hidden="true">
              <i className="ti ti-arrow-up-right" />
            </span>
            <div>
              <p className="ws360-report-modal__meta">Supervisão · Escalonamento</p>
              <h2 className="ws360-report-modal__title" id="ws360EscalateModalTitle">
                Escalonar ticket
              </h2>
              <p className="ws360-report-modal__generated">
                Pesquise pelo número do ticket ou CPF do cliente.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ws360-report-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </header>

        <div className="ws360-report-modal__body ws360-escalate-modal__body">
          <form className="ws360-escalate-modal__search" onSubmit={handleSearch}>
            <label className="ws360-escalate-modal__search-label" htmlFor="ws360EscalateSearch">
              Número do ticket ou CPF
            </label>
            <div className="ws360-escalate-modal__search-row">
              <input
                id="ws360EscalateSearch"
                type="search"
                className="ws360-escalate-modal__search-input"
                placeholder="Ex.: #12345 ou 123.456.789-01"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="ws360-btn ws360-btn--primary ws360-escalate-modal__search-btn">
                <i className="ti ti-search" aria-hidden="true" />
                Buscar
              </button>
            </div>
          </form>

          {searched && !results.length ? (
            <p className="ws360-redistribute-modal__empty">
              Nenhum ticket encontrado para esta busca.
            </p>
          ) : null}

          {results.length ? (
            <>
              <p className="ws360-escalate-modal__results-label">
                {results.length} ticket{results.length === 1 ? '' : 's'} encontrado{results.length === 1 ? '' : 's'}
              </p>
              <ul className="ws360-escalate-modal__results">
                {results.map((ticket) => {
                  const selected = selectedTicketId === ticket.id;
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        className={
                          'ws360-escalate-modal__result' + (selected ? ' is-selected' : '')
                        }
                        onClick={() => handleSelectTicket(ticket)}
                      >
                        <span className="ws360-escalate-modal__result-id">#{ticket.id}</span>
                        <span className="ws360-escalate-modal__result-main">
                          <strong>{ticket.title}</strong>
                          <span>
                            {ticket.clientName} · CPF {ticket.cpf} · {QUEUE_LABELS[ticket.queueId] || ticket.queueId}
                          </span>
                        </span>
                        {ticket.currentEscalonar ? (
                          <span className="ws360-escalate-modal__result-badge">
                            {getEscalonarLabel(ticket.currentEscalonar)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {selectedTicket ? (
            <section className="ws360-escalate-modal__options" aria-label="Destino do escalonamento">
              <h3 className="ws360-escalate-modal__options-title">Escalonar para</h3>
              <ul className="ws360-redistribute-modal__target-list">
                {ESCALONAR_OPTIONS.map((option) => (
                  <li key={option.id}>
                    <label
                      className={
                        'ws360-redistribute-modal__target-item' +
                        (escalonar === option.id ? ' is-selected' : '')
                      }
                    >
                      <input
                        type="radio"
                        name="supervisorEscalonar"
                        value={option.id}
                        checked={escalonar === option.id}
                        onChange={() => setEscalonar(option.id)}
                      />
                      <span className="ws360-redistribute-modal__target-name">{option.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className="ws360-report-modal__footer">
          <button type="button" className="btn-secondary ws360-report-modal__btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="ws360-btn ws360-btn--primary ws360-report-modal__btn"
            disabled={!selectedTicketId || !escalonar || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Escalonando…' : 'Confirmar escalonamento'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
