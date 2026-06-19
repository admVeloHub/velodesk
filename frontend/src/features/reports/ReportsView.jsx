/**
 * Relatórios — visão demo (frontend)
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React from 'react';

const REPORT_CARDS = [
  {
    id: 'sla',
    icon: 'fa-clock',
    title: 'SLA operacional',
    desc: 'Cumprimento de prazos por fila, canal e equipe.',
    action: 'Ver relatório SLA',
  },
  {
    id: 'volume',
    icon: 'fa-chart-bar',
    title: 'Volume de tickets',
    desc: 'Entradas, resolvidos e backlog por período.',
    action: 'Ver relatório de volume',
  },
  {
    id: 'nps',
    icon: 'fa-smile',
    title: 'NPS e satisfação',
    desc: 'Notas de atendimento e tendência semanal.',
    action: 'Ver relatório NPS',
  },
  {
    id: 'team',
    icon: 'fa-users',
    title: 'Performance da equipe',
    desc: 'TMA, TME e produtividade por agente.',
    action: 'Ver relatório de equipe',
  },
];

export default function ReportsView() {
  return (
    <div id="reports" className="page active">
      <div className="page-header">
        <h2>Relatórios</h2>
      </div>
      <div className="reports-container">
        <div className="reports-filters">
          <h3>Filtros</h3>
          <div className="reports-stats">
            <span>Período: Últimos 7 dias</span>
            <span>Canal: Todos</span>
            <span>Equipe: Todas</span>
          </div>
        </div>
        <div className="reports-grid">
          {REPORT_CARDS.map((card) => (
            <article key={card.id} className="report-card">
              <div className="report-icon">
                <i className={'fas ' + card.icon} aria-hidden="true" />
              </div>
              <div className="report-info">
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <button type="button" className="btn-primary">{card.action}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
