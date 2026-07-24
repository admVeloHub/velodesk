/**
 * GestaoVolumeStatsCard v1.0.0 — card com os totais do período (sem o gráfico)
 * DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import React from 'react';
import GestaoVolumeStats from './GestaoVolumeStats';
import './gestaoInsights.css';

export default function GestaoVolumeStatsCard({ period, onOpenTicket }) {
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

      <GestaoVolumeStats period={period} onOpenTicket={onOpenTicket} />
    </section>
  );
}
