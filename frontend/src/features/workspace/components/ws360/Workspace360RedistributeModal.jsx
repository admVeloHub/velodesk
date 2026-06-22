/**
 * Modal de redistribuição de tickets — supervisor (2 etapas)
 * VERSION: v1.0.0 | DATE: 2026-06-22
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectTicketsFromAgents,
  getAgentTicketGroups,
  getTargetAgentOptions,
  redistributeTickets,
} from '../../../../services/workspace/supervisorRedistributeData';

export default function Workspace360RedistributeModal({ open, onClose, onComplete }) {
  const [step, setStep] = useState('source');
  const [selectedSources, setSelectedSources] = useState([]);
  const [expandedAgents, setExpandedAgents] = useState({});
  const [targetAgent, setTargetAgent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agentGroups, setAgentGroups] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    setStep('source');
    setSelectedSources([]);
    setExpandedAgents({});
    setTargetAgent('');
    setSubmitting(false);
    setAgentGroups(getAgentTicketGroups());
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedTickets = useMemo(
    () => collectTicketsFromAgents(agentGroups, selectedSources),
    [agentGroups, selectedSources],
  );

  const targetAgents = useMemo(
    () => getTargetAgentOptions(selectedSources),
    [selectedSources],
  );

  if (!open) return null;

  const toggleSource = (name) => {
    setSelectedSources((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  };

  const toggleExpanded = (agentId) => {
    setExpandedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const handleAdvance = () => {
    if (!selectedSources.length || !selectedTickets.length) return;
    setTargetAgent('');
    setStep('target');
  };

  const handleBack = () => {
    setStep('source');
    setTargetAgent('');
  };

  const handleConfirm = async () => {
    if (!targetAgent || !selectedTickets.length) return;
    setSubmitting(true);
    try {
      const count = await redistributeTickets(
        selectedTickets.map((ticket) => ticket.id),
        targetAgent,
      );
      onComplete?.({ count, targetAgent, sources: selectedSources });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title = step === 'source'
    ? 'Redistribuir tickets — Selecionar origem'
    : 'Redistribuir tickets — Selecionar destino';

  const subtitle = step === 'source'
    ? 'Escolha os agentes cujos tickets serão redistribuídos.'
    : `${selectedTickets.length} ticket${selectedTickets.length === 1 ? '' : 's'} de ${selectedSources.length} agente${selectedSources.length === 1 ? '' : 's'} selecionado${selectedSources.length === 1 ? '' : 's'}.`;

  return createPortal(
    <>
      <button
        type="button"
        className="ws360-report-modal__backdrop"
        aria-label="Fechar redistribuição"
        onClick={onClose}
      />
      <div
        className="ws360-report-modal ws360-redistribute-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws360RedistributeModalTitle"
      >
        <header className="ws360-report-modal__header">
          <div className="ws360-report-modal__head-main">
            <span className="ws360-report-modal__icon" aria-hidden="true">
              <i className="ti ti-arrows-shuffle" />
            </span>
            <div>
              <p className="ws360-report-modal__meta">
                Etapa {step === 'source' ? '1' : '2'} de 2
              </p>
              <h2 className="ws360-report-modal__title" id="ws360RedistributeModalTitle">
                {title}
              </h2>
              <p className="ws360-report-modal__generated">{subtitle}</p>
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

        <div className="ws360-report-modal__body ws360-redistribute-modal__body">
          {step === 'source' ? (
            agentGroups.length ? (
              <ul className="ws360-redistribute-modal__agent-list">
                {agentGroups.map((group) => {
                  const checked = selectedSources.includes(group.name);
                  const expanded = Boolean(expandedAgents[group.id]);
                  return (
                    <li
                      key={group.id}
                      className={
                        'ws360-redistribute-modal__agent-item' +
                        (checked ? ' is-selected' : '')
                      }
                    >
                      <div className="ws360-redistribute-modal__agent-row">
                        <label className="ws360-redistribute-modal__agent-select">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSource(group.name)}
                          />
                          <span className="ws360-redistribute-modal__agent-main">
                            <strong>{group.name}</strong>
                            <span className="ws360-redistribute-modal__count">
                              {group.tickets.length} ticket{group.tickets.length === 1 ? '' : 's'}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className="ws360-redistribute-modal__toggle"
                          onClick={() => toggleExpanded(group.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? 'Ocultar' : 'Ver tickets'}
                          <i className={'ti ti-chevron-' + (expanded ? 'up' : 'down')} aria-hidden="true" />
                        </button>
                      </div>
                      {expanded ? (
                        <ul className="ws360-redistribute-modal__ticket-list">
                          {group.tickets.map((ticket) => (
                            <li key={ticket.id}>
                              <span className="ws360-redistribute-modal__ticket-id">#{ticket.id}</span>
                              <span className="ws360-redistribute-modal__ticket-title">{ticket.title}</span>
                              <span className="ws360-redistribute-modal__ticket-client">{ticket.clientName}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ws360-redistribute-modal__empty">
                Nenhum ticket aberto disponível para redistribuição.
              </p>
            )
          ) : (
            <>
              <div className="ws360-redistribute-modal__summary">
                <span>Origem:</span>
                <strong>{selectedSources.join(', ')}</strong>
              </div>
              <p className="ws360-redistribute-modal__hint">
                Selecione o agente que receberá os tickets selecionados.
              </p>
              <ul className="ws360-redistribute-modal__target-list">
                {targetAgents.map((agent) => (
                  <li key={agent.id}>
                    <label
                      className={
                        'ws360-redistribute-modal__target-item' +
                        (targetAgent === agent.name ? ' is-selected' : '')
                      }
                    >
                      <input
                        type="radio"
                        name="redistributeTargetAgent"
                        value={agent.name}
                        checked={targetAgent === agent.name}
                        onChange={() => setTargetAgent(agent.name)}
                      />
                      <span className="ws360-redistribute-modal__target-name">{agent.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {!targetAgents.length ? (
                <p className="ws360-redistribute-modal__empty">
                  Não há outros agentes disponíveis para receber estes tickets.
                </p>
              ) : null}
            </>
          )}
        </div>

        <footer className="ws360-report-modal__footer">
          {step === 'source' ? (
            <>
              <button type="button" className="btn-secondary ws360-report-modal__btn" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="ws360-btn ws360-btn--primary ws360-report-modal__btn"
                disabled={!selectedSources.length || !selectedTickets.length}
                onClick={handleAdvance}
              >
                Avançar
                <i className="ti ti-arrow-right" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-secondary ws360-report-modal__btn"
                onClick={handleBack}
                disabled={submitting}
              >
                Voltar
              </button>
              <button
                type="button"
                className="ws360-btn ws360-btn--primary ws360-report-modal__btn"
                disabled={!targetAgent || submitting}
                onClick={handleConfirm}
              >
                {submitting ? 'Redistribuindo…' : 'Confirmar redistribuição'}
              </button>
            </>
          )}
        </footer>
      </div>
    </>,
    document.body,
  );
}
