/**
 * Painel 360° — Supervisor
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeSupervisorData } from '../../services/workspace/deskData';
import { useNotifications } from '../../context/NotificationContext';

const TEAM = [
  { name: 'Ana Silva', sla: '98%', nps: 9, load: 82 },
  { name: 'Carlos Mendes', sla: '94%', nps: 8, load: 71 },
  { name: 'Julia Costa', sla: '91%', nps: 7, load: 65 }
];

export default function SupervisorPanel() {
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const d = computeSupervisorData();

  const quickAction = (label) => showNotification(label, 'info');

  return (
    <div className={'ws-super-desk' + (d.warRoom ? ' ws-super-desk--war-room' : '')} id="wsSuperDesk">
      <div className="ws-hero ws-hero--supervisor">
        <div>
          <span className="ws-eyebrow">Supervisão</span>
          <h3>Performance da equipe</h3>
          <p>SLA, escalonamentos e alertas em tempo real.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => navigate('/analytics-ia')}>
          <i className="fas fa-chart-line" /> Analytics
        </button>
      </div>
      <div className="ws-stats-grid">
        <div className="ws-stat-card"><i className="fas fa-percentage" /><strong>{d.slaPct}%</strong><span>SLA cumprido</span></div>
        <div className="ws-stat-card ws-stat-card--warn"><i className="fas fa-exclamation-triangle" /><strong>{d.slaRisk}</strong><span>Em risco de SLA</span></div>
        <div className="ws-stat-card"><i className="fas fa-users" /><strong>{d.online}</strong><span>Agentes online</span></div>
        <div className="ws-stat-card"><i className="fas fa-smile" /><strong>{d.nps}</strong><span>NPS médio</span></div>
      </div>
      <div className="ws-grid-2">
        <section className="ws-panel">
          <h4>Escalonamentos automáticos</h4>
          <ul className="ws-notif-list">
            <li className="ws-notif ws-notif--critical">Ticket #4512 — SLA 92% — Agente: Ana Silva</li>
            <li className="ws-notif ws-notif--warning">Risco de churn — Cliente Maria O. — Score 78</li>
            <li className="ws-notif">Palavra-chave &quot;Procon&quot; — Ticket #4509</li>
          </ul>
        </section>
        <section className="ws-panel">
          <h4>Ranking da equipe (hoje)</h4>
          <ol className="ws-ranking">
            {TEAM.map((m) => (
              <li key={m.name}>{m.name} <span>{m.sla} SLA · NPS {m.nps}</span></li>
            ))}
          </ol>
        </section>
      </div>
      <div className="ws-super-actions" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={() => quickAction('Redistribuição de tickets iniciada.')}>Redistribuir</button>
        <button type="button" className="btn-secondary" onClick={() => quickAction('Escalonamento enviado.')}>Escalonar</button>
        <button type="button" className="btn-secondary" onClick={() => navigate('/tickets?desk=v2')}>Abrir fila</button>
      </div>
    </div>
  );
}
