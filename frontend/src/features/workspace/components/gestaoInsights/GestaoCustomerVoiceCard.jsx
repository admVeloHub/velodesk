/**
 * GestaoCustomerVoiceCard v1.1.0 — congelado (em desenvolvimento)
 * VERSION: v1.1.0 | DATE: 2026-08-18
 * — Endpoint /voz-cliente desativado: consulta pesada em registro completo; card não crítico.
 */
import React from 'react';
import './gestaoInsights.css';

export default function GestaoCustomerVoiceCard() {
  return (
    <section className="ws-panel gestao-insight-card gestao-customer-voice gestao-customer-voice--frozen">
      <header className="gestao-insight-card__head gestao-customer-voice__head">
        <div>
          <h4>
            <i className="ti ti-sparkles" aria-hidden="true" /> Visão do cliente por IA
          </h4>
          <p>Leitura do relato do cliente, complementar à tabulação operacional.</p>
        </div>
        <span className="gestao-customer-voice__dev-badge">Em desenvolvimento</span>
      </header>

      <div className="gestao-customer-voice__frozen-body">
        <p className="gestao-customer-voice__frozen-text">
          Este card será reativado após refatoração de performance da análise de IA.
          O alerta de risco regulatório continua disponível no card ao lado.
        </p>
      </div>
    </section>
  );
}
