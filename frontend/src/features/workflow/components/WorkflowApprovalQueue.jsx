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
  const queueItems = items.filter((item) => !item.awaitingResponsavelReply);
  const pendingItems = items.filter((item) => item.awaitingResponsavelReply);

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
      <div className="wf-approval-queue__list">
        <ul className="wf-approval-queue__sublist wf-approval-queue__sublist--main">
          {queueItems.length === 0 ? (
            <li className="wf-approval-queue__empty">
              {searchActive
                ? 'Nenhum ticket encontrado para esta busca.'
                : 'Nenhum ticket encaminhado para este time no momento.'}
            </li>
          ) : queueItems.map((item) => (
            <WorkflowApprovalQueueItem
              key={item.id}
              item={item}
              active={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </ul>
        <div className="wf-approval-queue__divider">
          <span className="wf-approval-queue__divider-line" aria-hidden="true" />
          <span className="wf-approval-queue__divider-label">Pendentes</span>
          <span className="wf-approval-queue__divider-line" aria-hidden="true" />
        </div>
        <ul className="wf-approval-queue__sublist wf-approval-queue__sublist--pending">
          {pendingItems.length === 0 ? (
            <li className="wf-approval-queue__empty">
              {searchActive
                ? 'Nenhum ticket pendente encontrado para esta busca.'
                : 'Nenhum ticket pendente no momento.'}
            </li>
          ) : pendingItems.map((item) => (
            <WorkflowApprovalQueueItem
              key={item.id}
              item={item}
              active={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
            />
          ))}
        </ul>
      </div>
    </aside>
  );
}
