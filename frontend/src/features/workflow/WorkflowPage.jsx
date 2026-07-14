/**
 * WorkflowPage v1.0.0 — console de aprovação (/workflow)
 */
import React from 'react';
import WorkflowApprovalShell from './components/WorkflowApprovalShell';

export default function WorkflowPage() {
  return (
    <div id="workflow" className="page workflow-page eco-page active">
      <div className="eco-page-inner eco-page-inner--workflow">
        <WorkflowApprovalShell />
      </div>
    </div>
  );
}
