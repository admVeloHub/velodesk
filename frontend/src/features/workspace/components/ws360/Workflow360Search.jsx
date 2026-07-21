/**
 * Workflow360Search — busca por CPF ou ticket no painel Workflow 360°
 */
import React, { useCallback, useState } from 'react';
import {
  resolveOpenTarget,
  searchTicketsByQuery,
} from '../../../../services/workflow/workflowTicketSearch';

export default function Workflow360Search({
  teamQueueId,
  onOpenWorkflow,
  onOpenDesk,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  const openResult = useCallback((result) => {
    if (!result?.id) return;
    const target = resolveOpenTarget(result.ticket, teamQueueId);
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
    <article className="ws360-kpi ws360-workflow-search" aria-label="Buscar ticket">
      <form className="ws360-workflow-search__form" onSubmit={handleSubmit}>
        <label className="ws360-workflow-search__label" htmlFor="ws360WorkflowSearchInput">
          <i className="ti ti-search" aria-hidden="true" />
          Buscar
        </label>
        <div className="ws360-workflow-search__row">
          <input
            id="ws360WorkflowSearchInput"
            type="search"
            className="ws360-workflow-search__input"
            placeholder="CPF ou nº do ticket"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (error) setError('');
              if (results.length) setResults([]);
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            className="ws360-workflow-search__btn"
            disabled={searching}
            aria-label="Buscar ticket"
          >
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </div>
        {error ? (
          <p className="ws360-workflow-search__error" role="status">{error}</p>
        ) : null}
        {results.length > 1 ? (
          <ul className="ws360-workflow-search__results">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="ws360-workflow-search__result"
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
    </article>
  );
}
