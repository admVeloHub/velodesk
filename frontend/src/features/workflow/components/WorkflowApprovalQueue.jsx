/**
 * WorkflowApprovalQueue v1.0.0 — barra de busca sempre visível (paridade Desk)
 * VERSION: v1.0.0 | DATE: 2026-08-21
 */
import React from 'react';
import WorkflowApprovalQueueItem from './WorkflowApprovalQueueItem';
import WorkflowApprovalSearch from './WorkflowApprovalSearch';

export default function WorkflowApprovalQueue({
  queueLabel,
  items,
  selectedId,
  onSelect,
  searchQuery,
  searchActive,
  onSearchChange,
  onSearchSubmit,
}) {
  return (
    <aside className="wf-approval-queue" aria-label="Fila de workflow">
      <header className="wf-approval-queue__head">
        <h2>{queueLabel} · {items.length}</h2>
        <WorkflowApprovalSearch
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSearchSubmit={onSearchSubmit}
        />
      </header>
      <ul className="wf-approval-queue__list">
        {items.length === 0 ? (
          <li className="wf-approval-queue__empty">
            {searchActive
              ? 'Nenhum ticket encontrado para esta busca.'
              : 'Nenhum ticket encaminhado para este time no momento.'}
          </li>
        ) : items.map((item) => (
          <WorkflowApprovalQueueItem
            key={item.id}
            item={item}
            active={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </ul>
    </aside>
  );
}
