/**
 * GestaoVolumeStatsCard v1.0.0 — card com os totais do período (sem o gráfico)
 * DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import GestaoVolumeStats from './GestaoVolumeStats';
import './gestaoInsights.css';

export default function GestaoVolumeStatsCard({ period, onOpenTicket }) {
  return (
    <section className="ws-panel gestao-insight-card gestao-volume-stats-card">
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-list-numbers" />
          </span>
          Resumo do período
        </h4>
      </header>

      <GestaoVolumeStats period={period} onOpenTicket={onOpenTicket} />
    </section>
  );
}
