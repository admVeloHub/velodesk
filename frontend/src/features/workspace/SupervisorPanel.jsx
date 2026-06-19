/**

 * Painel 360° — Supervisor

 * VERSION: v2.1.0 | DATE: 2026-06-19

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



export default function SupervisorPanel() {

  const navigate = useNavigate();

  const { showNotification } = useNotifications();

  const { openTicket } = useTickets();

  const [escalatedListOpen, setEscalatedListOpen] = useState(false);

  const d = computeSupervisorData();



  const quickAction = (label) => showNotification(label, 'info');



  const handleOpenEscalatedTicket = useCallback((ticketId) => {

    if (typeof window.openTicket === 'function') {

      window.openTicket(ticketId);

      return;

    }

    openTicket(ticketId);

    navigate('/tickets?desk=v2');

  }, [navigate, openTicket]);



  return (

    <div className={'ws-super-desk' + (d.warRoom ? ' ws-super-desk--war-room' : '')} id="wsSuperDesk">

      <div className="ws-hero ws-hero--supervisor">

        <div>

          <span className="ws-eyebrow">Supervisão</span>

          <h3>Performance da equipe</h3>

          <p>SLA, escalonamentos e alertas em tempo real.</p>

        </div>

        <div className="ws-hero-actions">

          <button type="button" className="btn-secondary" onClick={() => quickAction('Redistribuição de tickets iniciada.')}>

            Redistribuir

          </button>

          <button type="button" className="btn-secondary" onClick={() => quickAction('Escalonamento enviado.')}>

            Escalonar

          </button>

          <button type="button" className="btn-secondary" onClick={() => navigate('/tickets?desk=v2')}>

            Abrir fila

          </button>

          <button type="button" className="btn-primary" onClick={() => navigate('/analytics-ia')}>

            <i className="fas fa-chart-line" /> Analytics

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

    </div>

  );

}


