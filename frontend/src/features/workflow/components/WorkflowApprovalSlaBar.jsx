import React from 'react';

export default function WorkflowApprovalSlaBar({ label, pct }) {
  return (
    <div className="wf-approval-sla">
      <div className="wf-approval-sla__label">
        <i className="ti ti-clock-exclamation" aria-hidden="true" />
        {label}
      </div>
      <div className="wf-approval-sla__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="wf-approval-sla__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
