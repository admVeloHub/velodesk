/**
 * GestaoVolumeStats v1.1.0 — totais do período; suporta slice do GET /gestao-insights/painel
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import React, { useEffect, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import './gestaoInsights.css';

export default function GestaoVolumeStats({ period, onOpenTicket, painelData, painelLoading }) {
  const managedByPainel = painelData !== undefined || painelLoading !== undefined;
  const [localData, setLocalData] = useState(null);
  const [localLoading, setLocalLoading] = useState(!managedByPainel);

  useEffect(() => {
    if (managedByPainel) return undefined;
    let active = true;
    setLocalLoading(true);
    gestaoInsightsApi
      .resumo({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setLocalData(result);
      })
      .catch(() => {
        if (active) setLocalData(null);
      })
      .finally(() => {
        if (active) setLocalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to, managedByPainel]);

  const data = managedByPainel ? painelData : localData;
  const loading = managedByPainel ? Boolean(painelLoading) : localLoading;
  const [expanded, setExpanded] = useState(false);

  const oldest = data?.oldestAbertos ?? [];
  const oldestFirst = oldest[0];

  return (
    <div className="gestao-volume-stats gestao-volume-stats--compact">
      <div className="gestao-volume-stats__tile" title="Total de tickets abertos no período selecionado">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalAbertos ?? 0}</span>
        <span className="gestao-volume-stats__label">Abertos</span>
      </div>
      <div className="gestao-volume-stats__tile" title='Tickets com status "Novo" no período'>
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalNovo ?? 0}</span>
        <span className="gestao-volume-stats__label">Novos</span>
      </div>
      <div className="gestao-volume-stats__tile" title="Novo + Em Andamento + Pendente no período">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.totalEmAberto ?? 0}</span>
        <span className="gestao-volume-stats__label">Em aberto</span>
      </div>
      <div className="gestao-volume-stats__tile" title="Tempo médio de tratativa: abertura → resolvido">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.tmaMedio ?? '—'}</span>
        <span className="gestao-volume-stats__label">TMA</span>
      </div>
      <div className="gestao-volume-stats__tile" title="Prazo médio de 1ª resposta: abertura → atendente">
        <span className="gestao-volume-stats__value">{loading ? '—' : data?.tmeMedio ?? '—'}</span>
        <span className="gestao-volume-stats__label">1ª resposta</span>
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
            Mais antigo em aberto
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
