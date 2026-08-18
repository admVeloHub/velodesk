/**
 * GestaoVolumeStatsCard v1.1.0 — repassa slice do painel unificado
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import React from 'react';
import GestaoVolumeStats from './GestaoVolumeStats';
import './gestaoInsights.css';

export default function GestaoVolumeStatsCard({ period, onOpenTicket, painelData, painelLoading }) {
  return (
    <section className="ws-panel gestao-insight-card gestao-volume-stats-card gestao-volume-stats-card--compact">
      <header className="gestao-insight-card__head gestao-insight-card__head--compact">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-list-numbers" />
          </span>
          Resumo
        </h4>
      </header>

      <GestaoVolumeStats
        period={period}
        onOpenTicket={onOpenTicket}
        painelData={painelData}
        painelLoading={painelLoading}
      />
    </section>
  );
}
