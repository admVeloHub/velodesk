/**
 * Dashboard executivo
 * VERSION: v2.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
import { getAllCockpitTickets } from '../../services/kanbanStorage';
import { statsApi } from '../../api/client';
import { useTickets } from '../../context/TicketsContext';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function DashboardView() {
  const { refreshKey, refreshTickets } = useTickets();
  const [stats, setStats] = useState(null);
  void refreshKey;

  useEffect(() => {
    statsApi.dashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, [refreshKey]);

  const tickets = getAllCockpitTickets();
  const resolved = stats?.resolved ?? tickets.filter((e) => e.queueId === 'resolvidos').length;
  const inProgress = stats?.inProgress ?? tickets.filter((e) => e.queueId === 'em-andamento').length;
  const pending = stats?.pending ?? tickets.filter((e) => e.queueId === 'pendente' || e.queueId === 'novos').length;
  const total = stats?.total ?? tickets.length;

  const lineData = {
    labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    datasets: [{ label: 'Tickets', data: stats?.weekly || [12, 19, 14, 22, resolved || 8], borderColor: '#1634FF', tension: 0.3 }],
  };

  const doughnutData = {
    labels: ['Resolvidos', 'Em andamento', 'Pendentes'],
    datasets: [{ data: [resolved, inProgress, pending], backgroundColor: ['#15A237', '#1634FF', '#FCC200'] }],
  };

  return (
    <div id="dashboard" className="page active">
      <div className="page-header">
        <h2>Dashboard Executivo</h2>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={() => refreshTickets()}><i className="fas fa-sync-alt" /> Atualizar</button>
          <button type="button" className="btn-primary"><i className="fas fa-download" /> Exportar</button>
        </div>
      </div>
      <div className="dashboard-container">
        <div className="kpi-section">
          <h3>Indicadores Principais</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-info"><h4>Tickets Resolvidos</h4><span className="kpi-value">{resolved}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Total na fila</h4><span className="kpi-value">{total}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Satisfação</h4><span className="kpi-value">{stats?.satisfaction ?? '92%'}</span></div></div>
            <div className="kpi-card"><div className="kpi-info"><h4>Agentes Ativos</h4><span className="kpi-value">{stats?.activeAgents ?? 4}</span></div></div>
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
