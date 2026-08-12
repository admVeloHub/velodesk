/**
 * Painel 360° — Agente
 * VERSION: v3.2.0 | DATE: 2026-08-12
 * — Exibe alerta de SLA crítico quando a API/local retorna `alert`
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildAgent360View,
  computeAgent360View,
  buildDeskNavigationForWs360Section,
  buildDeskNavigationForWs360Ticket,
} from '../../services/workspace/deskData';
import { useWorkspace360 } from '../../hooks/useWorkspace360';
import { getAgentName } from '../../services/clientDb';
import { markWorkflowInfoRequestsReadForTicket } from '../../services/workflow/workflowInfoNotifications';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360Alert from './components/ws360/Workspace360Alert';
import Workspace360DualTicketSection from './components/ws360/Workspace360DualTicketSection';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';
import Workspace360ProductionChart from './components/ws360/Workspace360ProductionChart';

export default function AgentPanel() {
  const navigate = useNavigate();
  const { data, loading, error } = useWorkspace360();
  const [infoRevision, setInfoRevision] = useState(0);

  useEffect(() => {
    const onInfoChanged = () => setInfoRevision((value) => value + 1);
    window.addEventListener('velodesk:workflow-info-changed', onInfoChanged);
    return () => window.removeEventListener('velodesk:workflow-info-changed', onInfoChanged);
  }, []);

  const view = useMemo(() => {
    if (data) return buildAgent360View(data, getAgentName());
    if (!loading) return computeAgent360View();
    return null;
  }, [data, loading, infoRevision]);

  const clientReplied = view?.sections?.find((s) => s.id === 'client-replied');
  const actionNow = view?.sections?.find((s) => s.id === 'action-now');
  const workflow = view?.sections?.find((s) => s.id === 'workflow');

  const handleOpenTicket = useCallback((ticketId, sectionId) => {
    markWorkflowInfoRequestsReadForTicket(ticketId);
    navigate(buildDeskNavigationForWs360Ticket(ticketId, sectionId));
  }, [navigate]);

  const handleSeeAll = useCallback((sectionId) => {
    navigate(buildDeskNavigationForWs360Section(sectionId));
  }, [navigate]);

  const handleOpenAlert = useCallback((ticketId) => {
    handleOpenTicket(ticketId, 'action-now');
  }, [handleOpenTicket]);

  if (loading && !view) {
    return <div className="ws-agent-desk ws-agent-desk--operational"><p className="ws360-loading">Carregando painel…</p></div>;
  }

  if (!view) return null;

  return (
    <div className="ws-agent-desk ws-agent-desk--operational ws-agent-desk--cockpit" id="wsAgentDesk">
      {error ? (
        <p className="ws360-error ws360-error--inline" role="status">
          API indisponível — exibindo dados locais da fila.
        </p>
      ) : null}
      <Workspace360Alert alert={view.alert} onOpen={handleOpenAlert} />
      <Workspace360Kpis kpis={view.kpis} />
      <Workspace360DualTicketSection
        leftSection={actionNow}
        rightSection={clientReplied}
        onOpenTicket={handleOpenTicket}
        onSeeAll={handleSeeAll}
      />
      <div className="ws360-sections-row ws360-sections-row--bottom ws360-sections-row--lead">
        <div className="ws360-sections-row__stack ws360-sections-row__stack--lead">
          {workflow ? (
            <Workspace360TicketSection
              section={workflow}
              onOpenTicket={handleOpenTicket}
              onSeeAll={handleSeeAll}
            />
          ) : (
            <div className="ws360-sections-row__spacer" aria-hidden="true" />
          )}
        </div>
        <Workspace360ProductionChart days={view.productionWeek} />
      </div>
    </div>
  );
}
