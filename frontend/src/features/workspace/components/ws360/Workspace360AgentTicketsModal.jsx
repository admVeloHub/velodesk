/**
 * Modal de drill-down — tickets "em andamento" de um colaborador (Leaderboard operacional)
 * VERSION: v1.0.0 | DATE: 2026-08-10
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchAgentInProgressTickets } from '../../../../services/workspace/workspace360Api';
import { mapEntryToRow } from '../../../../services/workspace/deskData';
import Workspace360TicketRow from './Workspace360TicketRow';

export default function Workspace360AgentTicketsModal({ agent, onClose, onOpenTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const open = Boolean(agent);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!agent?.agentKey) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    fetchAgentInProgressTickets({ agentKey: agent.agentKey })
      .then((result) => {
        if (active) setTickets(result.map((entry) => mapEntryToRow(entry, 'in-progress')));
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os tickets em andamento.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [agent?.agentKey]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="ws360-report-modal__backdrop"
        aria-label="Fechar lista de tickets"
        onClick={onClose}
      />
      <div
        className="ws360-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws360AgentTicketsModalTitle"
      >
        <header className="ws360-report-modal__header">
          <div className="ws360-report-modal__head-main">
            <span className="ws360-report-modal__icon" aria-hidden="true">
              <i className="ti ti-progress" />
            </span>
            <div>
              <p className="ws360-report-modal__meta">Do mais antigo para o mais novo</p>
              <h2 className="ws360-report-modal__title" id="ws360AgentTicketsModalTitle">
                Tickets em andamento — {agent?.name}
              </h2>
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

        <div className="ws360-report-modal__body">
          {error ? <p className="gestao-insight-card__error">{error}</p> : null}

          {loading ? (
            <p className="gestao-insight-card__loading">Carregando tickets…</p>
          ) : tickets.length === 0 ? (
            <p className="gestao-insight-card__empty">Nenhum ticket em andamento para este colaborador.</p>
          ) : (
            <div className="ws360-escalated-list__rows">
              {tickets.map((row) => (
                <Workspace360TicketRow key={row.id} ticket={row} onOpen={onOpenTicket} />
              ))}
            </div>
          )}
        </div>

        <footer className="ws360-report-modal__footer">
          <button type="button" className="btn-secondary ws360-report-modal__btn" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
