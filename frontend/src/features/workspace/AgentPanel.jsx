/**
 * Painel 360° — Agente
 * VERSION: v2.6.1 | DATE: 2026-06-19
 */
import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeAgent360View } from '../../services/workspace/deskData';
import { useTickets } from '../../context/TicketsContext';
import Workspace360Kpis from './components/ws360/Workspace360Kpis';
import Workspace360DualTicketSection from './components/ws360/Workspace360DualTicketSection';
import Workspace360TicketSection from './components/ws360/Workspace360TicketSection';
import Workspace360ProductionChart from './components/ws360/Workspace360ProductionChart';

export default function AgentPanel() {
  const navigate = useNavigate();
  const { openTicket } = useTickets();
  const view = useMemo(() => computeAgent360View(), []);

  const clientReplied = view.sections.find((s) => s.id === 'client-replied');
  const actionNow = view.sections.find((s) => s.id === 'action-now');
  const workflow = view.sections.find((s) => s.id === 'workflow');

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

  return (
    <div className="ws-agent-desk ws-agent-desk--operational ws-agent-desk--cockpit" id="wsAgentDesk">
      <Workspace360Kpis kpis={view.kpis} />
      <Workspace360DualTicketSection
        leftSection={actionNow}
        rightSection={clientReplied}
        onOpenTicket={handleOpenTicket}
        onSeeAll={handleSeeAll}
      />
      <div className="ws360-sections-row ws360-sections-row--bottom ws360-sections-row--lead">
        {workflow ? (
          <Workspace360TicketSection
            section={workflow}
            onOpenTicket={handleOpenTicket}
            onSeeAll={handleSeeAll}
          />
        ) : (
          <div className="ws360-sections-row__spacer" aria-hidden="true" />
        )}
        <Workspace360ProductionChart days={view.productionWeek} />
      </div>
    </div>
  );
}
