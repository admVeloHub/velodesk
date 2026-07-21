/**
 * Painel 360° — Workflow (+ CTA persistidos)
 * VERSION: v1.3.0 | DATE: 2026-07-21
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeWorkflow360View } from '../../services/workspace/deskData';
import { resolveWorkflowTeamQueueForUser } from '../../services/permissions/permissionService';
import { getWorkflowTeamQueueMeta } from '../../services/workflow/workflowTeamQueues';
import { workflowNotificacoesApi } from '../../api/client';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';
import Workflow360Search from './components/ws360/Workflow360Search';

export default function WorkflowPanel() {
  const navigate = useNavigate();
  const teamQueueId = useMemo(() => resolveWorkflowTeamQueueForUser(), []);
  const teamMeta = useMemo(
    () => (teamQueueId ? getWorkflowTeamQueueMeta(teamQueueId) : null),
    [teamQueueId],
  );
  const view = useMemo(() => computeWorkflow360View(teamQueueId), [teamQueueId]);
  const [ctaPending, setCtaPending] = useState([]);

  useEffect(() => {
    workflowNotificacoesApi.list()
      .then((data) => setCtaPending((data?.notificacoes || []).filter((n) => !n.lida)))
      .catch(() => setCtaPending([]));
  }, []);

  const handleOpenTicket = useCallback((ticketId) => {
    navigate(`/workflow?ticket=${ticketId}`);
  }, [navigate]);

  const handleSeeAll = useCallback(() => {
    navigate('/workflow');
  }, [navigate]);

  const handleOpenDeskTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    navigate(`/tickets?desk=v2&ticket=${ticketId}`);
  }, [navigate]);

  const queueTitle = teamMeta?.name || 'Workflow';

  return (
    <div className="ws-workflow-desk ws-agent-desk--operational" id="wsWorkflowDesk">
      <div className="ws-hero ws-hero--workflow">
        <div>
          <span className="ws-eyebrow">{queueTitle}</span>
          <h3>{teamQueueId ? `Fila ${queueTitle}` : 'Fluxos operacionais entre times'}</h3>
          <p>
            {teamQueueId
              ? `Acompanhe encaminhamentos, SLAs e decisões pendentes do time ${queueTitle}.`
              : 'Acompanhe etapas, SLAs e encaminhamentos ativos em todos os tickets.'}
          </p>
          {ctaPending.length ? (
            <p className="ws-workflow-cta-hint">
              {ctaPending.length} call to action pendente{ctaPending.length > 1 ? 's' : ''} para você.
            </p>
          ) : null}
        </div>
        <div className="ws-hero-actions">
          <button type="button" className="btn-primary" onClick={() => navigate('/workflow')}>
            <i className="fas fa-check-double" /> Abrir fila {queueTitle}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-chart-line" /> Dashboard
          </button>
        </div>
      </div>

      <Workspace360Kpis
        kpis={view.kpis}
        gridAppend={(
          <Workflow360Search
            teamQueueId={teamQueueId}
            onOpenWorkflow={handleOpenTicket}
            onOpenDesk={handleOpenDeskTicket}
          />
        )}
        gridAppendInline
        ariaLabel="Indicadores de workflow"
        title="Indicadores"
      />

      <div className="ws360-sections-row ws360-sections-row--bottom ws360-sections-row--workflow-grid">
        <div className="ws360-sections-row__stack ws360-sections-row__stack--lead">
          {view.sections
            .filter((section) => section.id === 'workflow-active')
            .map((section) => (
              <Workspace360TicketSection
                key={section.id}
                section={section}
                onOpenTicket={handleOpenTicket}
                onSeeAll={handleSeeAll}
              />
            ))}
        </div>
        <div className="ws360-sections-row__stack ws360-sections-row__stack--trail">
          {view.sections
            .filter((section) => section.id === 'workflow-external')
            .map((section) => (
              <Workspace360TicketSection
                key={section.id}
                section={section}
                onOpenTicket={handleOpenTicket}
                onSeeAll={handleSeeAll}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
