import React from 'react';

export default function WorkflowApprovalKpis({ summary }) {
  if (!summary) return null;
  const decisionCount = summary.awaitingDecisionCount ?? summary.pendingCount;
  return (
    <div className="wf-approval-kpis" aria-label="Resumo da fila">
      <article className="wf-approval-kpi wf-approval-kpi--pending">
        <strong>{summary.pendingCount}</strong>
        <span>Tickets na fila</span>
      </article>
      <article className="wf-approval-kpi wf-approval-kpi--warn">
        <strong>{decisionCount}</strong>
        <span>Aguardando decisão</span>
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
