import React from 'react';

export default function WorkflowApprovalKpis({ summary }) {
  if (!summary) return null;
  return (
    <div className="wf-approval-kpis" aria-label="Resumo de decisões">
      <article className="wf-approval-kpi wf-approval-kpi--pending">
        <strong>{summary.pendingCount}</strong>
        <span>Aguardando aprovação</span>
      </article>
      <article className="wf-approval-kpi wf-approval-kpi--success">
        <strong>{summary.approvedTodayCount}</strong>
        <span>Aprovados hoje</span>
      </article>
      <article className="wf-approval-kpi wf-approval-kpi--critical">
        <strong>{summary.slaCriticalCount}</strong>
        <span>SLA crítico</span>
      </article>
    </div>
  );
}
