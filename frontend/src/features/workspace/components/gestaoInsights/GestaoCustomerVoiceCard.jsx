/**
 * GestaoCustomerVoiceCard v1.0.0 — visão do cliente por IA e drill-down
 */
import React, { useEffect, useState } from 'react';
import { gestaoInsightsApi, ticketIaAnalysisApi } from '../../../../api/client';
import './gestaoInsights.css';

const SENTIMENT_LABELS = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  irritado: 'Irritado',
  confuso: 'Confuso',
  critico: 'Crítico',
};

function queryForPeriod(period, extra = {}) {
  return { period: period.period, from: period.from, to: period.to, ...extra };
}

export default function GestaoCustomerVoiceCard({ period, onOpenTicket }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [correction, setCorrection] = useState({});

  const load = () => {
    setLoading(true);
    gestaoInsightsApi.vozCliente(queryForPeriod(period))
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    gestaoInsightsApi.vozCliente(queryForPeriod(period))
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

  const openDrill = async (type, value) => {
    setDrill({ type, value });
    setDrillLoading(true);
    try {
      const result = await gestaoInsightsApi.vozClienteTickets(queryForPeriod(period, {
        [type]: value,
      }));
      setTickets(result.items || []);
    } finally {
      setDrillLoading(false);
    }
  };

  const correct = async (ticket) => {
    const motivo = String(correction[ticket.id] || '').trim();
    if (!motivo) return;
    await ticketIaAnalysisApi.correctReason({
      chamadoId: ticket.id,
      motivo,
      promoteTaxonomy: true,
      createAliasFrom: ticket.motivo,
    });
    setTickets((items) => items.map((item) => (
      item.id === ticket.id ? { ...item, motivo } : item
    )));
    setCorrection((prev) => ({ ...prev, [ticket.id]: '' }));
    load();
  };

  return (
    <section className="ws-panel gestao-insight-card gestao-customer-voice">
      <header className="gestao-insight-card__head gestao-customer-voice__head">
        <div>
          <h4><i className="ti ti-sparkles" aria-hidden="true" /> Visão do cliente por IA</h4>
          <p>Leitura do relato do cliente, complementar à tabulação operacional.</p>
        </div>
        {data ? <span className="gestao-customer-voice__coverage">{data.coverage.pct}% analisado</span> : null}
      </header>

      {loading ? (
        <p className="gestao-insight-card__loading">Analisando cobertura…</p>
      ) : !data ? (
        <p className="gestao-insight-card__error">Não foi possível carregar a visão por IA.</p>
      ) : drill ? (
        <div className="gestao-customer-drill">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrill(null)}>
            <i className="ti ti-arrow-left" aria-hidden="true" /> Voltar ao resumo
          </button>
          <h5>
            Tickets por {drill.type === 'motivo' ? 'motivo' : 'sentimento'}: {drill.value}
          </h5>
          {drillLoading ? <p>Carregando tickets…</p> : tickets.length === 0 ? (
            <p>Nenhum ticket encontrado neste recorte.</p>
          ) : (
            <div className="gestao-customer-drill__list">
              {tickets.map((ticket) => (
                <article key={ticket.id}>
                  <div className="gestao-customer-drill__main">
                    <strong>#{ticket.protocolo} · {ticket.titulo}</strong>
                    <span>{ticket.motivo} · {SENTIMENT_LABELS[ticket.sentimento] || ticket.sentimento}</span>
                    <small>Fonte: {ticket.qualidadeFonte === 'direto_cliente' ? 'fala direta' : 'resumo do atendente'}</small>
                  </div>
                  <div className="gestao-customer-drill__actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenTicket(ticket.id)}>
                      Abrir
                    </button>
                    <input
                      type="text"
                      value={correction[ticket.id] || ''}
                      placeholder="Corrigir motivo"
                      onChange={(event) => setCorrection((prev) => ({
                        ...prev,
                        [ticket.id]: event.target.value,
                      }))}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => correct(ticket)}>
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => ticketIaAnalysisApi.reanalyze({ chamadoId: ticket.id })}
                    >
                      Reanalisar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="gestao-customer-voice__grid">
          <div className="gestao-customer-voice__panel">
            <h5>Principais motivos</h5>
            {data.reasons.length === 0 ? <p>Sem tickets analisados.</p> : data.reasons.map((item) => (
              <button key={item.motivo} type="button" onClick={() => openDrill('motivo', item.motivo)}>
                <span>{item.motivo}</span>
                <strong>{item.pct}%</strong>
                <i style={{ width: `${item.pct}%` }} />
              </button>
            ))}
          </div>
          <div className="gestao-customer-voice__panel">
            <h5>Sentimento percebido</h5>
            {data.sentiments.map((item) => (
              <button
                key={item.sentimento}
                type="button"
                className={`is-${item.sentimento}`}
                onClick={() => openDrill('sentimento', item.sentimento)}
              >
                <span>{SENTIMENT_LABELS[item.sentimento] || item.sentimento}</span>
                <strong>{item.pct}%</strong>
                <i style={{ width: `${item.pct}%` }} />
              </button>
            ))}
          </div>
          <div className="gestao-customer-voice__panel gestao-customer-voice__metrics">
            <h5>Cobertura e qualidade</h5>
            <div><span>Elegíveis</span><strong>{data.coverage.eligible}</strong></div>
            <div><span>Analisados / cacheados</span><strong>{data.coverage.analyzed}</strong></div>
            <div><span>Pendentes</span><strong>{data.coverage.pending}</strong></div>
            <div><span>Fala direta</span><strong>{data.coverage.directSource}</strong></div>
            <div><span>Resumo transcrito</span><strong>{data.coverage.transcribedSource}</strong></div>
            <div className="is-warning">
              <span>Divergência da tabulação</span><strong>{data.divergence.pct}%</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
