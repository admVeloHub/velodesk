/**
 * Painel 360° — Agente
 * VERSION: v3.0.1 | DATE: 2026-07-14
 */
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildAgent360View, computeAgent360View } from '../../services/workspace/deskData';
import { useWorkspace360 } from '../../hooks/useWorkspace360';
import { useTickets } from '../../context/TicketsContext';
import { getAgentName } from '../../services/clientDb';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360DualTicketSection from './components/ws360/Workspace360DualTicketSection';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';
import Workspace360ProductionChart from './components/ws360/Workspace360ProductionChart';
import Workspace360ServiceStatus from './components/ws360/Workspace360ServiceStatus';

export default function AgentPanel() {
  const navigate = useNavigate();
  const { openTicket } = useTickets();
  const { data, loading, error } = useWorkspace360();

  const view = useMemo(() => {
    if (data) return buildAgent360View(data, getAgentName());
    if (!loading) return computeAgent360View();
    return null;
  }, [data, loading]);

  const clientReplied = view?.sections?.find((s) => s.id === 'client-replied');
  const actionNow = view?.sections?.find((s) => s.id === 'action-now');
  const workflow = view?.sections?.find((s) => s.id === 'workflow');

  const handleOpenTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    openTicket(ticketId);
  }, [openTicket]);

  const handleSeeAll = useCallback(() => {
    navigate('/tickets?desk=v2');
  }, [navigate]);

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
      <Workspace360Kpis
        kpis={view.kpis}
        gridAppend={<Workspace360ServiceStatus className="ws360-service-status--agent-kpi" tagsOnly />}
      />
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
