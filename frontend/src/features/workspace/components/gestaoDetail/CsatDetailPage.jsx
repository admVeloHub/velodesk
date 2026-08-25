/**
 * CsatDetailPage v1.0.0 — painel dedicado de CSAT: nota média geral, por atendente,
 * tendência diária e comentários recentes.
 * DATE: 2026-08-25 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { gestaoInsightsApi } from '../../../../api/client';
import GestaoPeriodFilter from '../gestaoInsights/GestaoPeriodFilter';
import '../aiUsage/aiUsage.css';
import '../gestaoInsights/gestaoInsights.css';
import './gestaoDetail.css';

ChartJS.register(
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

function formatNota(value) {
  return value == null ? '—' : Number(value).toFixed(1);
}

export default function CsatDetailPage() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState({ period: 'mes' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .csat({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o resumo de CSAT.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

  const chartData = useMemo(() => {
    const series = data?.tendencia ?? [];
    return {
      labels: series.map((day) => day.label),
      datasets: [
        {
          type: 'bar',
          label: 'Respostas',
          data: series.map((day) => day.respostas),
          backgroundColor: '#C7D0FF',
          borderRadius: 4,
          maxBarThickness: 24,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Nota média',
          data: series.map((day) => day.notaMedia),
          borderColor: '#1634FF',
          backgroundColor: '#1634FF',
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          yAxisID: 'y1',
          spanGaps: true,
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      },
      scales: {
        y: {
          beginAtZero: true,
          position: 'left',
          grid: { display: false },
          title: { display: true, text: 'Respostas' },
        },
        y1: {
          beginAtZero: true,
          suggestedMax: 5,
          position: 'right',
          grid: { display: false },
          title: { display: true, text: 'Nota (1-5)' },
        },
        x: { grid: { display: false } },
      },
    }),
    [],
  );

  const porAtendente = data?.porAtendente ?? [];
  const comentarios = data?.comentariosRecentes ?? [];

  return (
    <div className="page active gestao-detail-page" id="gestao-csat">
      <div className="eco-page-inner gestao-detail-page__inner">
        <header className="gestao-detail-page__header">
          <button type="button" className="gestao-detail-page__back" onClick={() => navigate('/workspace')}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar
          </button>
          <div className="gestao-detail-page__title-row">
            <span className="gestao-detail-page__icon" style={{ '--accent': '#1FAA59' }}>
              <i className="ti ti-star" aria-hidden="true" />
            </span>
            <div>
              <span className="gestao-detail-page__eyebrow">Satisfação do cliente</span>
              <h2 className="gestao-detail-page__title">CSAT</h2>
            </div>
          </div>
        </header>

        {error ? <p className="gestao-insight-card__error">{error}</p> : null}

        <section className="ws-panel gestao-detail-page__tiles-card">
          <div className="gestao-detail-page__tiles">
            <div className="gestao-detail-page__tile" style={{ '--accent': '#1FAA59' }}>
              <span className="gestao-detail-page__tile-value">{formatNota(data?.notaMedia)}</span>
              <span className="gestao-detail-page__tile-label">Nota média no período</span>
            </div>
            <div className="gestao-detail-page__tile" style={{ '--accent': '#1634FF' }}>
              <span className="gestao-detail-page__tile-value">{data?.totalRespostas ?? 0}</span>
              <span className="gestao-detail-page__tile-label">Respostas recebidas</span>
            </div>
          </div>
        </section>

        <section className="ws-panel gestao-insight-card gestao-detail-page__chart-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-chart-histogram" />
              </span>
              Tendência no período
            </h4>
            <GestaoPeriodFilter value={period} onChange={setPeriod} idPrefix="gestao-csat-detail" />
          </header>

          {loading ? (
            <p className="gestao-insight-card__loading">Carregando…</p>
          ) : (
            <div className="gestao-detail-page__chart-wrap">
              <Chart data={chartData} options={chartOptions} />
            </div>
          )}
        </section>

        <section className="ws-panel gestao-insight-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-users" />
              </span>
              Nota média por atendente
            </h4>
          </header>
          <table className="ai-usage-card__table">
            <thead>
              <tr>
                <th>Atendente</th>
                <th>Nota média</th>
                <th>Respostas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="ai-usage-card__table-empty">Carregando…</td>
                </tr>
              ) : porAtendente.length === 0 ? (
                <tr>
                  <td colSpan={3} className="ai-usage-card__table-empty">Nenhuma resposta de CSAT vinculada a um atendente no período.</td>
                </tr>
              ) : (
                porAtendente.map((row) => (
                  <tr key={row.responsavel}>
                    <td>{row.responsavel}</td>
                    <td>{formatNota(row.notaMedia)}</td>
                    <td>{row.respostas}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="ws-panel gestao-insight-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-message-circle" />
              </span>
              Comentários recentes
            </h4>
          </header>
          {loading ? (
            <p className="gestao-insight-card__loading">Carregando…</p>
          ) : comentarios.length === 0 ? (
            <p className="ai-usage-card__table-empty">Nenhum comentário recebido no período.</p>
          ) : (
            <div className="crm-internal-notes">
              {comentarios.map((c, index) => (
                <React.Fragment key={`${c.protocolo}-${c.respondidoEm}`}>
                  {index > 0 ? <hr className="crm-note-card__divider" aria-hidden="true" /> : null}
                  <article className="crm-note-card crm-note-card--registro">
                    <div className="crm-note-card__accent" aria-hidden="true" />
                    <div className="crm-note-card__inner">
                      <header className="crm-note-card__head">
                        <div className="crm-note-card__head-left">
                          <span className="crm-note-card__avatar crm-note-card__avatar--icon" aria-hidden="true">
                            <i className="ti ti-star" />
                          </span>
                          <div className="crm-note-card__meta">
                            <strong className="crm-note-card__author">Nota {c.nota}/5</strong>
                            <span className="crm-note-card__badge crm-note-card__badge--registro">
                              Protocolo {c.protocolo}
                            </span>
                          </div>
                        </div>
                        <time className="crm-note-card__time">
                          {c.respondidoEm ? new Date(c.respondidoEm).toLocaleDateString('pt-BR') : ''}
                        </time>
                      </header>
                      <p className="crm-note-card__body">{c.comentario}</p>
                    </div>
                  </article>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
