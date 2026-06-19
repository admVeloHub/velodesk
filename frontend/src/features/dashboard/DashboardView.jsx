/**
 * Dashboard executivo
 * VERSION: v2.2.0 | DATE: 2026-06-19 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { getAllCockpitTickets } from '../../services/kanbanStorage';
import { statsApi } from '../../api/client';
import { useTickets } from '../../context/TicketsContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  applyDashboardFilters,
  buildDashboardExportDocument,
  DASHBOARD_CHANNEL_OPTIONS,
  DASHBOARD_PERIOD_OPTIONS,
  DASHBOARD_TEAM_OPTIONS,
  downloadDashboardExport,
} from '../../services/dashboard/dashboardExport';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function DashboardView() {
  const { refreshKey, refreshTickets } = useTickets();
  const { showNotification } = useNotifications();
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('7d');
  const [channel, setChannel] = useState('all');
  const [team, setTeam] = useState('all');
  void refreshKey;

  useEffect(() => {
    statsApi.dashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  const tickets = getAllCockpitTickets();
  const baseMetrics = useMemo(() => ({
    resolved: stats?.resolved ?? tickets.filter((entry) => entry.queueId === 'resolvidos').length,
    inProgress: stats?.inProgress ?? tickets.filter((entry) => entry.queueId === 'em-andamento').length,
    pending: stats?.pending ?? tickets.filter((entry) => entry.queueId === 'pendente' || entry.queueId === 'novos').length,
    total: stats?.total ?? tickets.length,
    satisfaction: stats?.satisfaction ?? '92%',
    activeAgents: stats?.activeAgents ?? 4,
    weekly: stats?.weekly || [12, 19, 14, 22, tickets.filter((entry) => entry.queueId === 'resolvidos').length || 8],
  }), [stats, tickets]);

  const filters = useMemo(() => ({ period, channel, team }), [period, channel, team]);
  const metrics = useMemo(() => applyDashboardFilters(baseMetrics, filters), [baseMetrics, filters]);

  const lineData = {
    labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    datasets: [{ label: 'Tickets', data: metrics.weekly, borderColor: '#1634FF', tension: 0.3 }],
  };

  const doughnutData = {
    labels: ['Resolvidos', 'Em andamento', 'Pendentes'],
    datasets: [{ data: [metrics.resolved, metrics.inProgress, metrics.pending], backgroundColor: ['#15A237', '#1634FF', '#FCC200'] }],
  };

  const handleExport = () => {
    const documentPayload = buildDashboardExportDocument(metrics, filters);
    downloadDashboardExport(documentPayload);
    showNotification('Dashboard executivo exportado com sucesso.', 'success');
  };

  return (
    <div id="dashboard" className="page active">
      <div className="page-header">
        <h2>Dashboard Executivo</h2>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => refreshTickets()}>
            <i className="fas fa-sync-alt" /> Atualizar
          </button>
          <button type="button" className="btn-primary" onClick={handleExport}>
            <i className="fas fa-download" /> Exportar
          </button>
        </div>
      </div>

      <div className="dashboard-filter-bar">
        <span className="dashboard-filter-bar__label">
          <i className="ti ti-filter" aria-hidden="true" />
          Filtros
        </span>
        <div className="dashboard-filter-bar__controls">
          <select
            className="dashboard-filter-bar__select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Filtrar por período"
          >
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="dashboard-filter-bar__select"
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            aria-label="Filtrar por canal"
          >
            {DASHBOARD_CHANNEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="dashboard-filter-bar__select"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
            aria-label="Filtrar por equipe"
          >
            {DASHBOARD_TEAM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-container">
        <div className="kpi-section">
          <h3>Indicadores Principais</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-info"><h4>Tickets Resolvidos</h4><span className="kpi-value">{metrics.resolved}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Total na fila</h4><span className="kpi-value">{metrics.total}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Satisfação</h4><span className="kpi-value">{metrics.satisfaction}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Agentes Ativos</h4><span className="kpi-value">{metrics.activeAgents}</span></div></div>
          </div>
        </div>
        <div className="charts-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="chart-container"><Line data={lineData} /></div>
          <div className="chart-container"><Doughnut data={doughnutData} /></div>
        </div>
      </div>
    </div>
  );
}
