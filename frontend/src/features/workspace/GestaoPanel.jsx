/**
 * Painel 360° — Gestão
 * VERSION: v2.3.0 | DATE: 2026-07-13
 */
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { computeSupervisorData } from '../../services/workspace/deskData';
import { useNotifications } from '../../context/NotificationContext';
import { useTickets } from '../../context/TicketsContext';
import Workspace360SupervisorKpis from './components/ws360/Workspace360SupervisorKpis';
import Workspace360EscalatedCases from './components/ws360/Workspace360EscalatedCases';
import Workspace360EscalatedCasesList from './components/ws360/Workspace360EscalatedCasesList';
import Workspace360OperationalLeaderboard from './components/ws360/Workspace360OperationalLeaderboard';
import Workspace360SupervisorReports from './components/ws360/Workspace360SupervisorReports';
import Workspace360RedistributeModal from './components/ws360/Workspace360RedistributeModal';
import Workspace360EscalateModal from './components/ws360/Workspace360EscalateModal';

export default function GestaoPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();
  const [escalatedListOpen, setEscalatedListOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const d = computeSupervisorData();

  const handleOpenEscalatedTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    openTicket(ticketId);
    navigate('/tickets?desk=v2');
  }, [navigate, openTicket]);

  const handleRedistributeComplete = useCallback(async ({ count, targetAgent, sources }) => {
    await refreshTickets();
    const sourceLabel = sources.join(', ');
    showNotification(
      `${count} ticket${count === 1 ? '' : 's'} redistribuído${count === 1 ? '' : 's'} de ${sourceLabel} para ${targetAgent}.`,
      'success',
    );
  }, [refreshTickets, showNotification]);

  const handleEscalateComplete = useCallback(async ({ ticketId, label }) => {
    await refreshTickets();
    showNotification(`Ticket #${ticketId} escalonado para ${label}.`, 'success');
  }, [refreshTickets, showNotification]);

  return (
    <div className={'ws-super-desk' + (d.warRoom ? ' ws-super-desk--war-room' : '')} id="wsGestaoDesk">
      <div className="ws-hero ws-hero--mgmt">
        <div>
          <span className="ws-eyebrow">Gestão</span>
          <h3>Visão executiva da operação</h3>
          <p>SLA, performance da equipe, escalonamentos e alertas em tempo real.</p>
        </div>
        <div className="ws-hero-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRedistributeOpen(true)}
          >
            Redistribuir
          </button>
          <button type="button" className="btn-secondary" onClick={() => setEscalateOpen(true)}>
            Escalonar
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/tickets?desk=v2')}>
            Abrir fila
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-chart-line" /> Dashboard
          </button>
        </div>
      </div>

      <Workspace360SupervisorKpis kpis={d} />

      {escalatedListOpen ? (
        <Workspace360EscalatedCasesList
          onBack={() => setEscalatedListOpen(false)}
          onOpenTicket={handleOpenEscalatedTicket}
        />
      ) : (
        <>
          <div className="ws-grid-2">
            <Workspace360EscalatedCases
              onViewAll={() => setEscalatedListOpen(true)}
              onDismiss={() => showNotification('Alerta de escalonamento registrado.', 'info')}
            />
            <Workspace360OperationalLeaderboard />
          </div>
          <Workspace360SupervisorReports />
        </>
      )}

      <Workspace360RedistributeModal
        open={redistributeOpen}
        onClose={() => setRedistributeOpen(false)}
        onComplete={handleRedistributeComplete}
      />
      <Workspace360EscalateModal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onComplete={handleEscalateComplete}
      />
    </div>
  );
}
