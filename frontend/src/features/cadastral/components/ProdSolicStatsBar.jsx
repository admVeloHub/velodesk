/**
 * ProdSolicStatsBar — KPIs Hoje / Pendentes / Feitas
 */
import React from 'react';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function ProdSolicStatsBar({ stats, updatedAt, onRefresh }) {
  return (
    <div className="prod-solic-stats">
      <div className="prod-solic-stats__cards">
        <article className="prod-solic-stats__card">
          <span className="prod-solic-stats__label">Hoje</span>
          <strong className="prod-solic-stats__value">{stats.hoje}</strong>
        </article>
        <article className="prod-solic-stats__card">
          <span className="prod-solic-stats__label">Pendentes</span>
          <strong className="prod-solic-stats__value">{stats.pendentes}</strong>
        </article>
        <article className="prod-solic-stats__card">
          <span className="prod-solic-stats__label">Feitas</span>
          <strong className="prod-solic-stats__value">{stats.feitas}</strong>
        </article>
      </div>
      <div className="prod-solic-stats__refresh">
        <span className="prod-solic-stats__updated">
          Atualizado às {formatTime(updatedAt)}
        </span>
        <button type="button" className="prod-solic-stats__btn" onClick={onRefresh}>
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
