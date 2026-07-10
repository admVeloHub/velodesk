/**
 * Modal de redistribuição de tickets — supervisor (busca + 2 etapas)
 * VERSION: v2.1.0 | DATE: 2026-07-06
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collectTicketsFromAgents,
  getAgentOptions,
  getAgentTicketGroups,
  getTargetAgentOptions,
  redistributeTicket,
  redistributeTickets,
  searchTicketByNumber,
} from '../../../../services/workspace/supervisorRedistributeData';

export default function Workspace360RedistributeModal({ open, onClose, onComplete }) {
  const [step, setStep] = useState('source');
  const [selectedSources, setSelectedSources] = useState([]);
  const [expandedAgents, setExpandedAgents] = useState({});
  const [targetAgent, setTargetAgent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agentGroups, setAgentGroups] = useState([]);
  const [targetAgents, setTargetAgents] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searchTargetAgent, setSearchTargetAgent] = useState('');
  const [searchAgents, setSearchAgents] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchSubmitting, setSearchSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    setStep('source');
    setSelectedSources([]);
    setExpandedAgents({});
    setTargetAgent('');
    setSubmitting(false);
    setSearchQuery('');
    setSearchResult(null);
    setSearchError('');
    setSearchTargetAgent('');
    setSearching(false);
    setSearchSubmitting(false);

    let active = true;
    getAgentTicketGroups().then((groups) => {
      if (active) setAgentGroups(groups);
    });

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      active = false;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || step !== 'target') return undefined;
    let active = true;
    getTargetAgentOptions(selectedSources).then((agents) => {
      if (active) setTargetAgents(agents);
    });
    return () => { active = false; };
  }, [open, step, selectedSources]);

  useEffect(() => {
    if (!searchResult) {
      getAgentOptions().then(setSearchAgents);
      return;
    }
    getAgentOptions(searchResult.currentAgent).then((list) => {
      setSearchAgents(list);
      setSearchTargetAgent('');
    });
  }, [searchResult]);

  const selectedTickets = useMemo(
    () => collectTicketsFromAgents(agentGroups, selectedSources),
    [agentGroups, selectedSources],
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

  const handleSearch = async (event) => {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    setSearchTargetAgent('');

    try {
      const result = await searchTicketByNumber(query);
      if (!result) {
        setSearchError('Nenhum ticket encontrado para este número.');
        return;
      }
      setSearchResult(result);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchSave = async () => {
    if (!searchResult || !searchTargetAgent) return;
    setSearchSubmitting(true);
    setSearchError('');
    try {
      const outcome = await redistributeTicket(
        searchResult.id,
        searchTargetAgent,
        searchResult.ticket,
      );
      onComplete?.(outcome);
      onClose();
    } catch (err) {
      setSearchError(err?.message || 'Não foi possível redistribuir o ticket.');
    } finally {
      setSearchSubmitting(false);
    }
  };

  const ticketLabel = searchResult?.protocol
    ? `#${searchResult.protocol}`
    : searchResult
      ? `#${searchResult.id}`
      : '';

  const searchBlock = (
    <>
      <form className="ws360-redistribute-modal__search" onSubmit={handleSearch}>
        <label className="ws360-redistribute-modal__search-label" htmlFor="ws360RedistributeSearch">
          Buscar ticket por número
        </label>
        <div className="ws360-redistribute-modal__search-row">
          <input
            id="ws360RedistributeSearch"
            type="search"
            className="ws360-redistribute-modal__search-input"
            placeholder="Protocolo ou número do ticket"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="ws360-btn ws360-btn--primary ws360-redistribute-modal__search-btn"
            disabled={!searchQuery.trim() || searching}
          >
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {searchError ? (
        <p className="ws360-redistribute-modal__empty" role="alert">{searchError}</p>
      ) : null}

      {searchResult ? (
        <article className="ws360-redistribute-modal__result">
          <div className="ws360-redistribute-modal__result-main">
            <div className="ws360-redistribute-modal__result-head">
              <span className="ws360-redistribute-modal__ticket-id">{ticketLabel}</span>
              <strong className="ws360-redistribute-modal__ticket-title">{searchResult.title}</strong>
            </div>
            <p className="ws360-redistribute-modal__result-meta">
              {searchResult.clientName} · {searchResult.status} · Responsável: {searchResult.currentAgent}
            </p>
          </div>
          <div className="ws360-redistribute-modal__result-actions">
            <select
              className="ws360-redistribute-modal__agent-select"
              value={searchTargetAgent}
              onChange={(e) => setSearchTargetAgent(e.target.value)}
              aria-label="Selecionar agente para redistribuição"
            >
              <option value="">Selecionar agente</option>
              {searchAgents.map((agent) => (
                <option key={agent.id} value={agent.name}>{agent.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="ws360-btn ws360-btn--primary ws360-redistribute-modal__save-btn"
              disabled={!searchTargetAgent || searchSubmitting}
              onClick={handleSearchSave}
            >
              {searchSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </article>
      ) : null}
    </>
  );

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
              {step === 'target' ? (
                <p className="ws360-report-modal__meta">Etapa 2 de 2</p>
              ) : null}
              <h2 className="ws360-report-modal__title" id="ws360RedistributeModalTitle">
                Redistribuir tickets
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

        <div className="ws360-report-modal__body ws360-redistribute-modal__body">
          {step === 'source' ? (
            <>
              {searchBlock}
              <div className="ws360-redistribute-modal__divider">
                <span>ou selecione por agente</span>
              </div>
              {agentGroups.length ? (
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
                  Nenhum ticket aberto disponível para redistribuição em lote.
                </p>
              )}
            </>
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
