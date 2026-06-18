/**
 * Painel 360° — Agente
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeAgentDeskData } from '../../services/workspace/deskData';
import { useTickets } from '../../context/TicketsContext';

export default function AgentPanel() {
  const navigate = useNavigate();
  const { openTicket } = useTickets();
  const desk = computeAgentDeskData();
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = desk.agentName.split(' ')[0];

  return (
    <div className="ws-agent-desk ws-agent-desk--operational ws-agent-desk--cockpit" id="wsAgentDesk">
      <header className="ws-action-panel ws-action-panel--level-2">
        <div className="ws-action-panel__top">
          <div className="ws-action-panel__intro">
            <span className="ws-action-panel__date">{now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <h3 className="ws-action-panel__greeting">{greeting}, {firstName}.</h3>
            <p className="ws-action-focus">Seu foco agora:</p>
            <ul className="ws-action-focus-list">
              {desk.counts.slaCritico > 0 && <li>{desk.counts.slaCritico} ticket(s) com SLA crítico</li>}
              {desk.counts.novos > 0 && <li>{desk.counts.novos} novo(s) na fila</li>}
              {!desk.counts.slaCritico && !desk.counts.novos && <li>Fila em dia — nenhuma urgência imediata</li>}
            </ul>
            <div className="ws-action-briefing-today">
              <span className="ws-action-briefing-today__label">Hoje:</span>
              {' '}SLA <strong>{desk.personal.sla}%</strong> · TMA <strong>{desk.personal.tma}</strong> · CSAT <strong>{desk.personal.csat}</strong>
            </div>
            <div className="ws-action-metrics">
              {desk.counts.slaCritico > 0 && <span className="ws-metric-pill ws-metric-pill--critical ws-metric-pill--live">{desk.counts.slaCritico} SLA crítico</span>}
              {desk.counts.aguardandoRetorno > 0 && <span className="ws-metric-pill ws-metric-pill--warn">{desk.counts.aguardandoRetorno} aguardando retorno</span>}
              {desk.counts.novos > 0 && <span className="ws-metric-pill ws-metric-pill--new ws-metric-pill--bounce">{desk.counts.novos} novos</span>}
            </div>
          </div>
        </div>
        <div className="ws-action-panel__cta-row">
          {desk.nextAction ? (
            <button type="button" className="ws-action-cta ws-action-cta--primary" onClick={() => openTicket(desk.nextAction.ticket.id)}>
              <i className="fas fa-reply" /> Responder #{desk.nextAction.ticket.id}
            </button>
          ) : (
            <button type="button" className="ws-action-cta ws-action-cta--primary" onClick={() => navigate('/tickets?desk=v2')}>
              <i className="fas fa-inbox" /> Ver fila
            </button>
          )}
          <button type="button" className="ws-action-cta" onClick={() => window.dispatchEvent(new CustomEvent('velodesk:quick-register'))}>
            <i className="fas fa-plus" /> Novo ticket
          </button>
          <button type="button" className="ws-action-cta" onClick={() => navigate('/tickets?desk=v2')}>
            <i className="fas fa-inbox" /> Fila completa
          </button>
        </div>
      </header>

      <div className="ws-agent-layout">
        <div className="ws-agent-main">
          <section className="ws-panel ws-panel--queue ws-panel--level-2">
            <div className="ws-panel__head-row">
              <h4><i className="fas fa-list-ol" /> Fila operacional</h4>
              <span className="ws-panel__count">{desk.enriched.length} ticket(s)</span>
            </div>
            <div className="ws-queue-grid">
              {desk.enriched.slice(0, 8).map(({ ticket, queueId, sla }) => (
                <button
                  key={ticket.id}
                  type="button"
                  className={'ws-queue-card ws-queue-card--' + sla}
                  onClick={() => openTicket(ticket.id)}
                >
                  <strong>#{ticket.id}</strong>
                  <span>{ticket.clientName || ticket.title}</span>
                  <small>{queueId}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="ws-agent-insights">
          <section className="ws-panel ws-panel--hot ws-panel--level-3">
            <h4><i className="fas fa-fire" /> Risco &amp; SLA</h4>
            <ul className="ws-hot-list">
              {desk.hotClients.length === 0 && <li>Nenhum cliente em risco imediato</li>}
              {desk.hotClients.map(({ ticket }) => (
                <li key={ticket.id}><button type="button" className="ws-hot-link" onClick={() => openTicket(ticket.id)}>#{ticket.id} — {ticket.clientName}</button></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
