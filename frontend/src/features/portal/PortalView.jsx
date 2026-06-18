/**
 * Portal do Cliente (preview)
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React from 'react';

export default function PortalView() {
  return (
    <div id="client-portal" className="page eco-page active">
      <div className="page-header"><h2>Portal do Cliente</h2></div>
      <div className="eco-page-inner eco-stagger" id="clientPortalContent">
        <div className="portal-preview-banner"><i className="fas fa-eye" /> Pré-visualização do Portal do Cliente — self-service para reduzir volume de ligações</div>
        <div className="portal-mock">
          <header className="portal-mock-header"><h3>Olá, Maria!</h3><p>Acompanhe seus chamados</p></header>
          <div className="portal-mock-stats">
            <div><strong>2</strong><span>Abertos</span></div>
            <div><strong>5</strong><span>Resolvidos</span></div>
            <div><strong>4.8</strong><span>Avaliação</span></div>
          </div>
          <ul className="portal-mock-list">
            <li><span>#4521</span> Lentidão internet <em>Em andamento</em></li>
            <li><span>#4498</span> Segunda via fatura <em>Resolvido</em></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
