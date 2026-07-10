/**
 * Painel 360° — Supervisor
 * VERSION: v3.2.0 | DATE: 2026-07-06
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSupervisor360View, mapEntryToRow } from '../../services/workspace/deskData';
import { useWorkspace360 } from '../../hooks/useWorkspace360';
import { useNotifications } from '../../context/NotificationContext';
import { useTickets } from '../../context/TicketsContext';
import Workspace360SupervisorKpis from './components/ws360/Workspace360SupervisorKpis';
import Workspace360EscalatedCases from './components/ws360/Workspace360EscalatedCases';
import Workspace360EscalatedCasesList from './components/ws360/Workspace360EscalatedCasesList';
import Workspace360OperationalLeaderboard from './components/ws360/Workspace360OperationalLeaderboard';
import Workspace360SupervisorReports from './components/ws360/Workspace360SupervisorReports';
import Workspace360RedistributeModal from './components/ws360/Workspace360RedistributeModal';
import Workspace360EscalateModal from './components/ws360/Workspace360EscalateModal';

export default function SupervisorPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();
  const { data, loading, error, refresh } = useWorkspace360();
  const [escalatedListOpen, setEscalatedListOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const view = useMemo(() => (data ? buildSupervisor360View(data) : null), [data]);

  const escalatedListGroups = useMemo(() => {
    if (!view?.escalated?.groups) return [];
    return view.escalated.groups.map((group) => ({
      ...group,
      tickets: (group.entries ?? []).map((entry) => {
        const responsavel = entry.ticket?.responsibleAgent || entry.ticket?.lateralForm?.responsavel || '';
        const row = mapEntryToRow(entry, 'urgent');
        return {
          ...row,
          meta: responsavel ? `${row.meta ? `${row.meta} · ` : ''}Agente: ${responsavel}` : row.meta,
        };
      }),
    }));
  }, [view]);

  const handleOpenEscalatedTicket = useCallback((ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    openTicket(ticketId);
    navigate('/tickets?desk=v2');
  }, [navigate, openTicket]);

  const handleRedistributeComplete = useCallback(async (outcome) => {
    await refreshTickets();
    await refresh();
    if (outcome.sources?.length) {
      const sourceLabel = outcome.sources.join(', ');
      showNotification(
        `${outcome.count} ticket${outcome.count === 1 ? '' : 's'} redistribuído${outcome.count === 1 ? '' : 's'} de ${sourceLabel} para ${outcome.targetAgent}.`,
        'success',
      );
      return;
    }
    const fromLabel = outcome.previousAgent && outcome.previousAgent !== 'Sem responsável'
      ? ` de ${outcome.previousAgent}`
      : '';
    showNotification(
      `Ticket #${outcome.ticketId} redistribuído${fromLabel} para ${outcome.targetAgent}.`,
      'success',
    );
  }, [refreshTickets, refresh, showNotification]);

  const handleEscalateComplete = useCallback(async ({ ticketId, label }) => {
    await refreshTickets();
    await refresh();
    showNotification(`Ticket #${ticketId} escalonado para ${label}.`, 'success');
  }, [refreshTickets, refresh, showNotification]);

  if (loading && !view) {
    return <div className="ws-super-desk"><p className="ws360-loading">Carregando painel…</p></div>;
  }

  if (error && !view) {
    return (
      <div className="ws-super-desk">
        <p className="ws360-error" role="alert">Não foi possível carregar o Painel 360°.</p>
      </div>
    );
  }

  if (!view) return null;

  const d = view.kpis;

  return (
    <div className={'ws-super-desk' + (d.warRoom ? ' ws-super-desk--war-room' : '')} id="wsSuperDesk">
      <div className="ws-hero ws-hero--supervisor">
        <div>
          <h3>Performance da equipe</h3>
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
        </div>
      </div>

      <Workspace360SupervisorKpis kpis={d} />

      {escalatedListOpen ? (
        <Workspace360EscalatedCasesList
          groups={escalatedListGroups}
          slaCriticalCount={view.escalated?.slaCriticalCount ?? 0}
          onBack={() => setEscalatedListOpen(false)}
          onOpenTicket={handleOpenEscalatedTicket}
        />
      ) : (
        <>
          <div className="ws-grid-2">
            <Workspace360EscalatedCases
              escalated={view.escalated}
              channelVision={view.channelVision}
              onViewAll={() => setEscalatedListOpen(true)}
              onDismiss={() => showNotification('Alerta de escalonamento registrado.', 'info')}
            />
            <Workspace360OperationalLeaderboard entries={view.leaderboard} />
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
