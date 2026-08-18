/**
 * WorkflowPage v1.2.0 — console de aprovação (/workflow)
 * VERSION: v1.2.0 | DATE: 2026-08-05
 */
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasWorkflowPortalAccess } from '../../services/permissions/permissionService';
import WorkflowApprovalShell from './components/WorkflowApprovalShell';

export default function WorkflowPage() {
  const location = useLocation();

  useEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return undefined;

    mainContent.classList.remove('tickets-active');
    mainContent.style.background = 'transparent';
    mainContent.style.display = 'flex';
    mainContent.style.flexDirection = 'column';
    mainContent.style.minHeight = '0';
    mainContent.style.overflow = 'hidden';
    mainContent.style.padding = '0';

    const params = new URLSearchParams(location.search);
    const activePage = params.get('view') === 'finalizados' ? 'workflow-finalizados' : 'workflow-inbox';
    window.syncMainSidebarNav?.(activePage);

    return () => {
      mainContent.style.display = '';
      mainContent.style.flexDirection = '';
      mainContent.style.minHeight = '';
      mainContent.style.overflow = '';
      mainContent.style.padding = '';
    };
  }, []);

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
