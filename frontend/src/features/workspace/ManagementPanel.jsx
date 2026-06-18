/**
 * Painel 360° — Gestão
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeManagementStats } from '../../services/workspace/deskData';

export default function ManagementPanel() {
  const navigate = useNavigate();
  const stats = computeManagementStats();

  return (
    <div className="ws-mgmt-desk" id="wsMgmtDesk">
      <div className="ws-hero ws-hero--mgmt">
        <div>
          <span className="ws-eyebrow">Gestão</span>
          <h3>Visão estratégica</h3>
          <p>Indicadores executivos e previsões.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate('/analytics-ia')}>
          <i className="fas fa-chart-line" /> Analytics completo
        </button>
      </div>
      <div className="ws-stats-grid">
        <div className="ws-stat-card"><i className="fas fa-phone-volume" /><strong>{stats.volume.toLocaleString('pt-BR')}</strong><span>Volume hoje</span></div>
        <div className="ws-stat-card"><i className="fas fa-stopwatch" /><strong>{stats.tma}</strong><span>TMA</span></div>
        <div className="ws-stat-card"><i className="fas fa-check-double" /><strong>{stats.fcr}</strong><span>FCR</span></div>
        <div className="ws-stat-card"><i className="fas fa-chart-line" /><strong>{stats.forecast}</strong><span>Previsão amanhã</span></div>
      </div>
      <section className="ws-panel" style={{ marginTop: 24 }}>
        <h4><i className="fas fa-trophy" /> Resumo executivo</h4>
        <p>Tickets resolvidos hoje: <strong>{stats.resolved}</strong>. Volume operacional dentro da meta com tendência de crescimento moderado.</p>
        <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => navigate('/dashboard')}>Dashboard executivo</button>
      </section>
    </div>
  );
}
