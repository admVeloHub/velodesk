import React from 'react';
import WorkflowApprovalQueueItem from './WorkflowApprovalQueueItem';
import WorkflowApprovalSearch from './WorkflowApprovalSearch';

export default function WorkflowApprovalQueue({
  queueLabel,
  items,
  selectedId,
  onSelect,
  teamQueueId,
  onSearchOpenWorkflow,
  onSearchOpenDesk,
}) {
  return (
    <aside className="wf-approval-queue" aria-label="Fila de workflow">
      <header className="wf-approval-queue__head">
        <h2>{queueLabel} · {items.length}</h2>
        {teamQueueId ? (
          <WorkflowApprovalSearch
            teamQueueId={teamQueueId}
            onOpenWorkflow={onSearchOpenWorkflow}
            onOpenDesk={onSearchOpenDesk}
          />
        ) : null}
      </header>
      <ul className="wf-approval-queue__list">
        {items.length === 0 ? (
          <li className="wf-approval-queue__empty">Nenhum ticket encaminhado para este time no momento.</li>
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
