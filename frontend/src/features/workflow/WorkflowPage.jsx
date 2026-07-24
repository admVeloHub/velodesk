/**
 * WorkflowPage v1.1.0 — console de aprovação (/workflow)
 * VERSION: v1.1.0 | DATE: 2026-07-22
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasWorkflowPortalAccess } from '../../services/permissions/permissionService';
import WorkflowApprovalShell from './components/WorkflowApprovalShell';

export default function WorkflowPage() {
  if (!hasWorkflowPortalAccess()) {
    return <Navigate to="/workspace" replace />;
  }

  return (
    <div id="workflow" className="page workflow-page eco-page active">
      <div className="eco-page-inner eco-page-inner--workflow">
        <WorkflowApprovalShell />
      </div>
    </div>
  );
}
