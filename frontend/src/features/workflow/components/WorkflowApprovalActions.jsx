import React from 'react';

const ACTION_CONFIG = {
  approve: {
    label: 'Aprovar e processar estorno',
    icon: 'ti ti-check',
    className: 'wf-approval-action wf-approval-action--approve',
  },
  reject: {
    label: 'Reprovar',
    icon: 'ti ti-x',
    className: 'wf-approval-action wf-approval-action--reject',
  },
  request_info: {
    label: 'Pedir informação',
    icon: 'ti ti-message-circle',
    className: 'wf-approval-action wf-approval-action--info',
  },
};

export default function WorkflowApprovalActions({
  actions,
  busy,
  infoPanelOpen,
  onApprove,
  onReject,
  onRequestInfoOpen,
}) {
  const handlers = {
    approve: onApprove,
    reject: onReject,
    request_info: onRequestInfoOpen,
  };

  const list = (actions || ['approve', 'reject', 'request_info']).filter((id) => ACTION_CONFIG[id]);

  return (
    <div className="wf-approval-actions">
      {list.map((id) => {
        const cfg = ACTION_CONFIG[id];
        return (
          <button
            key={id}
            type="button"
            className={cfg.className + (id === 'request_info' && infoPanelOpen ? ' is-active' : '')}
            disabled={busy}
            onClick={handlers[id]}
            aria-expanded={id === 'request_info' ? infoPanelOpen : undefined}
          >
            <i className={cfg.icon} aria-hidden="true" />
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
