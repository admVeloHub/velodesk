/**
 * GestaoRiscoCasoEspecialCard v1.1.0 — alerta IA; suporta slice do GET /gestao-insights/painel
 * VERSION: v1.1.0 | DATE: 2026-08-18
 */
import React, { useEffect, useState } from 'react';
import { gestaoInsightsApi } from '../../../../api/client';
import './gestaoInsights.css';

const TIPO_ACCENT = {
  bacen: 'red',
  procon: 'amber',
  'reclame aqui': 'blue',
  'ação judicial': 'red',
  'órgão regulador': 'amber',
};

function accentForTipo(tipo) {
  return TIPO_ACCENT[String(tipo || '').trim().toLowerCase()] || 'navy';
}

export default function GestaoRiscoCasoEspecialCard({ onOpenTicket, painelData, painelLoading }) {
  const managedByPainel = painelData !== undefined || painelLoading !== undefined;
  const [localItems, setLocalItems] = useState([]);
  const [localLoading, setLocalLoading] = useState(!managedByPainel);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (managedByPainel) return undefined;
    let active = true;
    setLocalLoading(true);
    gestaoInsightsApi
      .riscoCasosEspeciais({ limit: 10 })
      .then((result) => {
        if (active) {
          setLocalItems(result?.items ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o alerta de IA.');
      })
      .finally(() => {
        if (active) setLocalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [managedByPainel]);

  const items = managedByPainel ? (painelData?.items ?? []) : localItems;
  const loading = managedByPainel ? Boolean(painelLoading) : localLoading;

  const count = items.length;

  return (
    <section className={`ws-panel gestao-insight-card gestao-risco-card${expanded ? ' gestao-risco-card--expanded' : ''}`}>
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-shield-exclamation" />
          </span>
          Risco de caso especial (IA)
        </h4>
        <span className="gestao-insight-card__mock-note" title="Análise automática do texto do cliente, feita em lote pela IA">
          <i className="ti ti-sparkles" aria-hidden="true" />
          Detecção automática
        </span>
      </header>

      {loading ? (
        <p className="gestao-insight-card__loading">Carregando…</p>
      ) : error ? (
        <p className="gestao-insight-card__error">{error}</p>
      ) : count === 0 ? (
        <div className="gestao-risco-card__summary gestao-risco-card__summary--empty">
          <span className="gestao-risco-card__summary-count">0</span>
          <span className="gestao-risco-card__summary-text">Nenhum risco identificado no momento</span>
        </div>
      ) : (
        <button
          type="button"
          className="gestao-risco-card__summary gestao-risco-card__summary--alert"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className="gestao-risco-card__summary-count">{count}</span>
          <span className="gestao-risco-card__summary-text">
            {count === 1
              ? 'risco identificado — ainda não escalonado formalmente'
              : 'riscos identificados — ainda não escalonados formalmente'}
          </span>
          <span className="gestao-risco-card__summary-toggle">
            {expanded ? 'Recolher' : 'Analisar'}
            <i className={`ti ti-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
          </span>
        </button>
      )}

      {expanded && !loading && !error && count > 0 ? (
        <>
          <p className="gestao-risco-card__hint">
            Tickets comuns onde a IA identificou menção do cliente a Bacen, Procon, Reclame Aqui ou ação judicial —
            ainda não escalonados formalmente. Aja antes que o caso avance.
          </p>
          <ul className="gestao-risco-card__list">
            {items.map((item) => (
              <li key={item.id} className={`gestao-risco-card__item gestao-risco-card__item--${accentForTipo(item.tipo)}`}>
                <div className="gestao-risco-card__info">
                  <div className="gestao-risco-card__top">
                    <span className="gestao-risco-card__tipo">{item.tipo}</span>
                    <strong>#{item.protocolo}</strong>
                    <span className="gestao-risco-card__age">{item.ageDays}d aberto</span>
                  </div>
                  <p className="gestao-risco-card__titulo">{item.titulo}</p>
                  {item.trecho ? <p className="gestao-risco-card__trecho">“{item.trecho}”</p> : null}
                </div>
                <button
                  type="button"
                  className="gestao-risco-card__open"
                  onClick={() => onOpenTicket?.(item.id)}
                >
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
