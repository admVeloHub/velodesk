/**
 * WorkflowApprovalSearch v1.0.0 — barra de busca paridade Desk (CPF/protocolo)
 * VERSION: v1.0.0 | DATE: 2026-08-21
 */
import React, { useEffect, useState } from 'react';
import { getDeskSearchInferredLabel } from '../../../services/desk/utils';

export default function WorkflowApprovalSearch({
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
}) {
  const [query, setQuery] = useState(searchQuery);
  const detectedLabel = getDeskSearchInferredLabel(query);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const handleQueryChange = (value) => {
    setQuery(value);
    onSearchChange?.(value);
  };

  return (
    <div
      className="queue-search queue-search--workflow"
      role="search"
      aria-label="Buscar ticket na fila de workflow"
    >
      <i className="ti ti-search" aria-hidden="true" />
      <input
        type="text"
        id="wfApprovalQueueSearch"
        name="wfApprovalQueueSearch"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        placeholder="Buscar por CPF ou protocolo…"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSearchSubmit?.();
          }
        }}
        aria-label="Buscar ticket por CPF ou protocolo"
      />
      <span
        className="queue-search__mode queue-search__mode--detected"
        title={`Busca detectada: ${detectedLabel}`}
        aria-live="polite"
      >
        {detectedLabel}
      </span>
    </div>
  );
}
