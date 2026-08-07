/**
 * WorkflowApprovalSearch — busca por CPF ou ticket na fila /workflow
 */
import React, { useCallback, useId, useState } from 'react';
import {
  resolveOpenTarget,
  searchTicketsByQuery,
  validateWorkflowTeamAccess,
} from '../../../services/workflow/workflowTicketSearch';

export default function WorkflowApprovalSearch({
  teamQueueId,
  onOpenWorkflow,
  onOpenDesk,
}) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const openResult = useCallback((result) => {
    if (!result?.id) return;
    const access = validateWorkflowTeamAccess(result.ticket, teamQueueId);
    if (!access.allowed) {
      setError(access.message || 'Ticket não pertence à sua fila de workflow.');
      setResults([]);
      return;
    }
    const target = access.target || resolveOpenTarget(result.ticket, teamQueueId);
    setResults([]);
    setError('');
    setQuery('');
    if (target === 'workflow') {
      onOpenWorkflow?.(result.id);
      return;
    }
    onOpenDesk?.(result.id);
  }, [onOpenDesk, onOpenWorkflow, teamQueueId]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Informe CPF ou número do ticket');
      setResults([]);
      return;
    }

    setSearching(true);
    setError('');
    try {
      const found = await searchTicketsByQuery(trimmed);
      if (!found.length) {
        setResults([]);
        setError('Nenhum ticket encontrado');
        return;
      }
      if (found.length === 1) {
        openResult(found[0]);
        return;
      }
      setResults(found);
    } catch {
      setResults([]);
      setError('Não foi possível buscar o ticket');
    } finally {
      setSearching(false);
    }
  }, [openResult, query]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    runSearch();
  }, [runSearch]);

  return (
    <div className="wf-approval-queue__search" aria-label="Buscar ticket">
      <form className="wf-approval-queue__search-form" onSubmit={handleSubmit}>
        <div className="wf-approval-queue__search-row">
          <i className="ti ti-search wf-approval-queue__search-icon" aria-hidden="true" />
          <input
            id={inputId}
            type="search"
            className="wf-approval-queue__search-input"
            placeholder="CPF ou nº do ticket"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (error) setError('');
              if (results.length) setResults([]);
            }}
            autoComplete="off"
            aria-label="CPF ou número do ticket"
          />
          <button
            type="submit"
            className="wf-approval-queue__search-btn"
            disabled={searching}
            aria-label="Buscar ticket"
          >
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </div>
        {error ? (
          <p className="wf-approval-queue__search-error" role="status">{error}</p>
        ) : null}
        {results.length > 1 ? (
          <ul className="wf-approval-queue__search-results">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="wf-approval-queue__search-result"
                  onClick={() => openResult(result)}
                >
                  <strong>{result.protocol}</strong>
                  <span>{result.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </div>
  );
}
