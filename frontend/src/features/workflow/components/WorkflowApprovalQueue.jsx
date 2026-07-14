import React from 'react';
import WorkflowApprovalQueueItem from './WorkflowApprovalQueueItem';

export default function WorkflowApprovalQueue({ queueLabel, items, selectedId, onSelect }) {
  return (
    <aside className="wf-approval-queue" aria-label="Fila de decisões">
      <header className="wf-approval-queue__head">
        <h2>{queueLabel} · {items.length}</h2>
      </header>
      <ul className="wf-approval-queue__list">
        {items.length === 0 ? (
          <li className="wf-approval-queue__empty">Nenhuma decisão pendente no momento.</li>
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
