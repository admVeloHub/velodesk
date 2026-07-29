/**
 * GestaoRiscoCasoEspecialCard v1.0.0 — alerta precoce de IA: menção a caso grave em tickets
 * comuns (Bacen/Procon/Reclame Aqui/ação judicial), ainda não escalonados formalmente.
 * DATE: 2026-07-23 | AUTHOR: VeloHub Development Team
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

export default function GestaoRiscoCasoEspecialCard({ onOpenTicket }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    gestaoInsightsApi
      .riscoCasosEspeciais({ limit: 10 })
      .then((result) => {
        if (active) {
          setItems(result?.items ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o alerta de IA.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="ws-panel gestao-insight-card gestao-risco-card">
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

      <p className="gestao-risco-card__hint">
        Tickets comuns onde a IA identificou menção do cliente a Bacen, Procon, Reclame Aqui ou ação judicial —
        ainda não escalonados formalmente. Aja antes que o caso avance.
      </p>

      {loading ? (
        <p className="gestao-insight-card__loading">Carregando…</p>
      ) : error ? (
        <p className="gestao-insight-card__error">{error}</p>
      ) : items.length === 0 ? (
        <p className="gestao-insight-card__empty">Nenhum risco identificado no momento.</p>
      ) : (
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
      )}
    </section>
  );
}
