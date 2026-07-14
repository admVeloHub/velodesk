import React from 'react';

export default function WorkflowApprovalQueueItem({ item, active, onSelect }) {
  const timeCritical = item.timeCritical || item.urgencyBadge?.tone === 'critical';

  return (
    <li>
      <button
        type="button"
        className={'wf-approval-queue-item' + (active ? ' is-active' : '')}
        onClick={onSelect}
      >
        <div className="wf-approval-queue-item__top">
          <strong>{item.clientName}</strong>
          <span className={'wf-approval-queue-item__time' + (timeCritical ? ' is-critical' : '')}>
            {item.timeLabel || item.elapsedLabel}
          </span>
        </div>
        <p className="wf-approval-queue-item__subject">{item.subject}</p>
        <div className="wf-approval-queue-item__meta">
          <span className="wf-approval-queue-item__channel">
            <i className={item.channel.icon} aria-hidden="true" />
            {item.channel.label}
          </span>
          {item.urgencyBadge?.tone === 'critical' ? (
            <span className="wf-approval-badge wf-approval-badge--critical">{item.urgencyBadge.text}</span>
          ) : (
            <span className={'wf-approval-badge wf-approval-badge--' + item.slaBadge.tone}>{item.slaBadge.text}</span>
          )}
        </div>
      </button>
    </li>
  );
}
