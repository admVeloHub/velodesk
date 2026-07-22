/**
 * Painel 360° — Workflow (+ CTA persistidos)
 * VERSION: v1.4.0 | DATE: 2026-07-22
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeWorkflow360View } from '../../services/workspace/deskData';
import { resolveWorkflowTeamQueueForUser } from '../../services/permissions/permissionService';
import {
  buildWorkflowNavigationUrl,
  getWorkflowTeamQueueMeta,
  resolveWorkflowTeamForTicket,
} from '../../services/workflow/workflowTeamQueues';
import { findTicketEntry } from '../../services/ticketsStorage';
import { workflowNotificacoesApi } from '../../api/client';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';
import Workflow360Search from './components/ws360/Workflow360Search';
import WorkflowTeamPicker from '../workflow/components/WorkflowTeamPicker';

export default function WorkflowPanel() {
  const navigate = useNavigate();
  const openQueueBtnRef = useRef(null);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
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

  const navigateToWorkflowTeam = useCallback((teamId, ticketId) => {
    navigate(buildWorkflowNavigationUrl({ teamId, ticketId }));
  }, [navigate]);

  const handleOpenQueue = useCallback(() => {
    if (teamQueueId) {
      navigateToWorkflowTeam(teamQueueId);
      return;
    }
    setTeamPickerOpen(true);
  }, [navigateToWorkflowTeam, teamQueueId]);

  const handleSelectTeamFromPicker = useCallback((teamId) => {
    setTeamPickerOpen(false);
    navigateToWorkflowTeam(teamId);
  }, [navigateToWorkflowTeam]);

  const handleOpenTicket = useCallback((ticketId) => {
    const entry = findTicketEntry(ticketId);
    const inferredTeam = teamQueueId || resolveWorkflowTeamForTicket(entry?.ticket);
    navigate(buildWorkflowNavigationUrl({ teamId: inferredTeam, ticketId }));
  }, [navigate, teamQueueId]);

  const handleSeeAll = useCallback(() => {
    handleOpenQueue();
  }, [handleOpenQueue]);

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
          <button
            ref={openQueueBtnRef}
            type="button"
            className="btn-primary"
            onClick={handleOpenQueue}
          >
            <i className="fas fa-check-double" /> Abrir fila {queueTitle}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-chart-line" /> Dashboard
          </button>
        </div>
      </div>

      {!teamQueueId ? (
        <WorkflowTeamPicker
          variant="popover"
          anchorRef={openQueueBtnRef}
          open={teamPickerOpen}
          onSelect={handleSelectTeamFromPicker}
          onClose={() => setTeamPickerOpen(false)}
        />
      ) : null}

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
