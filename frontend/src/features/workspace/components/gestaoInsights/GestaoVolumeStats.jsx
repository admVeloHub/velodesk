/**
 * GestaoVolumeStats v1.0.0 — totais do período (abertos/novo/em aberto) + ticket em aberto mais antigo
 * DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import './gestaoInsights.css';

export default function GestaoVolumeStats({ period, onOpenTicket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gestaoInsightsApi
      .resumo({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

  const oldest = data?.oldestAbertos ?? [];
  const oldestFirst = oldest[0];

  return (
    <div className="gestao-volume-stats">
      <div className="gestao-volume-stats__tile">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalAbertos ?? 0}</span>
        <span className="gestao-volume-stats__label">Abertos no período</span>
      </div>
      <div className="gestao-volume-stats__tile">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalNovo ?? 0}</span>
        <span className="gestao-volume-stats__label">Status "Novo"</span>
      </div>
      <div className="gestao-volume-stats__tile">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalEmAberto ?? 0}</span>
        <span className="gestao-volume-stats__label">Em aberto (Novo + Em Andamento + Pendente)</span>
      </div>
      <div className="gestao-volume-stats__tile">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.tmaMedio ?? '—'}</span>
        <span className="gestao-volume-stats__label">TMA médio (abertura → resolvido)</span>
      </div>
      <div className="gestao-volume-stats__tile">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.tmeMedio ?? '—'}</span>
        <span className="gestao-volume-stats__label">1ª resposta (abertura → atendente)</span>
      </div>

      <div className={`gestao-volume-stats__tile gestao-volume-stats__tile--oldest${expanded ? ' gestao-volume-stats__tile--expanded' : ''}`}>
        <button
          type="button"
          className="gestao-volume-stats__oldest-toggle"
          onClick={() => setExpanded((v) => !v)}
          disabled={!oldest.length}
        >
          <span className="gestao-volume-stats__value">
            {loading ? '—' : oldestFirst ? `${oldestFirst.ageDays}d` : '—'}
          </span>
          <span className="gestao-volume-stats__label">
            Ticket em aberto mais antigo
            {oldestFirst ? ` · #${oldestFirst.protocolo}` : ''}
          </span>
          {oldest.length ? (
            <i className={`ti ti-chevron-${expanded ? 'up' : 'down'} gestao-volume-stats__chevron`} aria-hidden="true" />
          ) : null}
        </button>

        {expanded ? (
          <ul className="gestao-volume-stats__oldest-list">
            {oldest.map((ticket) => (
              <li key={ticket.id} className="gestao-volume-stats__oldest-item">
                <div className="gestao-volume-stats__oldest-info">
                  <strong>#{ticket.protocolo}</strong>
                  <span>{ticket.motivo || ticket.titulo}</span>
                  <span className="gestao-volume-stats__oldest-meta">
                    {ticket.produto ? `${ticket.produto} · ` : ''}{ticket.ageDays} dia{ticket.ageDays === 1 ? '' : 's'} em aberto
                  </span>
                </div>
                <button
                  type="button"
                  className="gestao-volume-stats__oldest-open"
                  onClick={() => onOpenTicket?.(ticket.id)}
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
