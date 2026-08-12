/**
 * Painel 360° — Gestão
 * VERSION: v3.6.0 | DATE: 2026-08-12
 * — KPIs supervisor + visão por canal montados a partir do payload 360
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
import Workspace360SupervisorKpis from './components/ws360/Workspace360SupervisorKpis';
import Workspace360ChannelVision from './components/ws360/Workspace360ChannelVision';
import GestaoVolumeCard from './components/gestaoInsights/GestaoVolumeCard';
import GestaoVolumeStatsCard from './components/gestaoInsights/GestaoVolumeStatsCard';
import GestaoMotivosCard from './components/gestaoInsights/GestaoMotivosCard';
import GestaoCasosEspeciaisCard from './components/gestaoInsights/GestaoCasosEspeciaisCard';
import GestaoRiscoCasoEspecialCard from './components/gestaoInsights/GestaoRiscoCasoEspecialCard';
import GestaoCustomerVoiceCard from './components/gestaoInsights/GestaoCustomerVoiceCard';
import GestaoPeriodFilter from './components/gestaoInsights/GestaoPeriodFilter';
import GestaoAdherenceCard from './components/gestaoInsights/GestaoAdherenceCard';
import AiUsageCostCard from './components/aiUsage/AiUsageCostCard';

export default function GestaoPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { openTicket, refreshTickets } = useTickets();
  const { data, loading, error, refresh } = useWorkspace360();
  const [escalatedListOpen, setEscalatedListOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
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

  const handleRedistributeComplete = useCallback(async () => {
    await refreshTickets();
    await refresh();
    showNotification('Redirecionamento concluído', 'success');
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
        <button type="button" className="btn-secondary" onClick={() => navigate('/tickets?desk=v2')}>
          Abrir fila
        </button>
      </div>

      <Workspace360SupervisorKpis kpis={d} />
      {Array.isArray(view.channelVision) && view.channelVision.length > 0 ? (
        <Workspace360ChannelVision channels={view.channelVision} />
      ) : null}

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

        <div className="gestao-insights-row gestao-insights-row--risco">
          <GestaoCustomerVoiceCard
            period={insightsPeriod}
            onOpenTicket={handleOpenEscalatedTicket}
          />
          <GestaoRiscoCasoEspecialCard onOpenTicket={handleOpenEscalatedTicket} />
          <GestaoAdherenceCard />
        </div>
      </div>

      <div className="ws-grid-2">
        <Workspace360OperationalLeaderboard onOpenTicket={handleOpenEscalatedTicket} />
      </div>
      <Workspace360SupervisorReports />

      <Workspace360RedistributeModal
        open={redistributeOpen}
        onClose={() => setRedistributeOpen(false)}
        onComplete={handleRedistributeComplete}
      />
    </div>
  );
}
