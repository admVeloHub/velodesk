/**
 * Painel 360° — Workflow
 * VERSION: v1.1.0 | DATE: 2026-07-13
 */
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeWorkflow360View } from '../../services/workspace/deskData';
import { findTicketEntryById } from '../../services/workflow/workflowApprovalData';
import { getWorkflowProgress } from '../../services/desk/utils';
import { ticketAwaitingDecision } from '../../services/desk/workflowDefinitions';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';

export default function WorkflowPanel() {
  const navigate = useNavigate();
  const view = useMemo(() => computeWorkflow360View(), []);

  const handleOpenTicket = useCallback((ticketId) => {
    const entry = findTicketEntryById(ticketId);
    if (entry) {
      const progress = getWorkflowProgress(entry.ticket);
      if (ticketAwaitingDecision(entry.ticket, progress)) {
        navigate(`/workflow?ticket=${ticketId}`);
        return;
      }
    }
    navigate('/workflow');
  }, [navigate]);

  const handleSeeAll = useCallback(() => {
    navigate('/workflow');
  }, [navigate]);

  return (
    <div className="ws-workflow-desk ws-agent-desk--operational" id="wsWorkflowDesk">
      <div className="ws-hero ws-hero--workflow">
        <div>
          <span className="ws-eyebrow">Workflow</span>
          <h3>Fluxos operacionais entre times</h3>
          <p>Acompanhe etapas, SLAs e encaminhamentos ativos em todos os tickets.</p>
        </div>
        <div className="ws-hero-actions">
          <button type="button" className="btn-primary" onClick={() => navigate('/workflow')}>
            <i className="fas fa-check-double" /> Abrir decisões
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-chart-line" /> Dashboard
          </button>
        </div>
      </div>

      <Workspace360Kpis kpis={view.kpis} />

      <div className="ws360-sections-row ws360-sections-row--bottom">
        {view.sections.map((section) => (
          <Workspace360TicketSection
            key={section.id}
            section={section}
            onOpenTicket={handleOpenTicket}
            onSeeAll={handleSeeAll}
          />
        ))}
      </div>
    </div>
  );
}
