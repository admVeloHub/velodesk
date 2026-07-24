/**
 * Painel 360° — Gestão
 * VERSION: v3.2.1 | DATE: 2026-07-14
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildSupervisor360View, computeSupervisor360View, mapEntryToRow } from '../../services/workspace/deskData';
import { useWorkspace360 } from '../../hooks/useWorkspace360';
import { useNotifications } from '../../context/NotificationContext';
import { useTickets } from '../../context/TicketsContext';
import Workspace360EscalatedCases from './components/ws360/Workspace360EscalatedCases';
import Workspace360EscalatedCasesList from './components/ws360/Workspace360EscalatedCasesList';
import Workspace360OperationalLeaderboard from './components/ws360/Workspace360OperationalLeaderboard';
import Workspace360SupervisorReports from './components/ws360/Workspace360SupervisorReports';
import Workspace360RedistributeModal from './components/ws360/Workspace360RedistributeModal';
import Workspace360EscalateModal from './components/ws360/Workspace360EscalateModal';
import GestaoVolumeCard from './components/gestaoInsights/GestaoVolumeCard';
import GestaoVolumeStatsCard from './components/gestaoInsights/GestaoVolumeStatsCard';
import GestaoMotivosCard from './components/gestaoInsights/GestaoMotivosCard';
import GestaoCasosEspeciaisCard from './components/gestaoInsights/GestaoCasosEspeciaisCard';
import GestaoPeriodFilter from './components/gestaoInsights/GestaoPeriodFilter';
import AiUsageCostCard from './components/aiUsage/AiUsageCostCard';

export default function GestaoPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();
  const { data, loading, error, refresh } = useWorkspace360();
  const [escalatedListOpen, setEscalatedListOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [insightsPeriod, setInsightsPeriod] = useState({ period: 'mes' });

  const view = useMemo(() => {
    if (data) return buildSupervisor360View(data);
    if (!loading) return computeSupervisor360View();
    return null;
  }, [data, loading]);

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

  if (!view) return null;

  const d = view.kpis;

  return (
    <div className={'ws-super-desk' + (d.warRoom ? ' ws-super-desk--war-room' : '')} id="wsGestaoDesk">
      {error ? (
        <p className="ws360-error ws360-error--inline" role="status">
          API indisponível — exibindo dados locais da fila.
        </p>
      ) : null}
      <div className="gestao-actions-bar">
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

      <div className="gestao-period-row">
        <span className="gestao-period-row__label">
          <i className="ti ti-calendar-stats" aria-hidden="true" />
          Período de análise
        </span>
        <GestaoPeriodFilter value={insightsPeriod} onChange={setInsightsPeriod} idPrefix="gestao-global" />
      </div>

      <div className="gestao-insights-stack">
        <div className="gestao-insights-row gestao-insights-row--summary">
          <GestaoVolumeStatsCard period={insightsPeriod} onOpenTicket={handleOpenEscalatedTicket} />
          <Workspace360EscalatedCases
            escalated={view.escalated}
            onViewAll={() => setEscalatedListOpen(true)}
            onDismiss={() => showNotification('Alerta de escalonamento registrado.', 'info')}
            onOpenTicket={handleOpenEscalatedTicket}
          />
        </div>

        {escalatedListOpen ? (
          <Workspace360EscalatedCasesList
            groups={escalatedListGroups}
            slaCriticalCount={view.escalated?.slaCriticalCount ?? 0}
            onBack={() => setEscalatedListOpen(false)}
            onOpenTicket={handleOpenEscalatedTicket}
          />
        ) : null}

        <div className="gestao-insights-row gestao-insights-row--chart">
          <GestaoVolumeCard period={insightsPeriod} />
          <GestaoMotivosCard period={insightsPeriod} />
        </div>

        <div className="gestao-tiles-row">
          <GestaoCasosEspeciaisCard />
          <AiUsageCostCard />
        </div>
      </div>

      <div className="ws-grid-2">
        <Workspace360OperationalLeaderboard />
      </div>
      <Workspace360SupervisorReports />

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
