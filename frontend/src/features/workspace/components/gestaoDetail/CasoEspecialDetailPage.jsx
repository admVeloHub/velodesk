/**
 * CasoEspecialDetailPage v1.0.0 — detalhe de um órgão/canal de caso especial
 * (Bacen/Procon/Consumidor.gov/Reclame Aqui): totais mês/ano, série comparativa (MoM/YoY)
 * e principais motivos por produto.
 * DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import GestaoGranularityToggle from '../gestaoInsights/GestaoGranularityToggle';
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

const ORGAO_META = {
  bacen: { color: '#000058', icon: 'ti-building-bank', label: 'Bacen' },
  procon: { color: '#1634FF', icon: 'ti-scale', label: 'Procon' },
  consumidorGov: { color: '#006AB9', icon: 'ti-gavel', label: 'Consumidor.gov' },
  reclameAqui: { color: '#FCC200', icon: 'ti-message-report', label: 'Reclame Aqui' },
};

function formatCompareLabel(mode) {
  if (mode === 'mom') return 'período imediatamente anterior';
  if (mode === 'yoy') return 'mesmo período do ano anterior';
  return '';
}

export default function CasoEspecialDetailPage() {
  const { orgao } = useParams();
  const navigate = useNavigate();
  const meta = ORGAO_META[orgao] ?? { color: '#1634FF', icon: 'ti-flag', label: orgao };

  const [period, setPeriod] = useState({ period: 'mes' });
  const [compareMode, setCompareMode] = useState('');
  const [granularity, setGranularity] = useState('dia');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (granularity === 'mes' && compareMode === 'mom') setCompareMode('');
  }, [granularity, compareMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .casoEspecialDetail(orgao, {
        period: period.period,
        from: period.from,
        to: period.to,
        compare: compareMode || undefined,
        granularity,
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o detalhe deste órgão/canal.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgao, period.period, period.from, period.to, compareMode, granularity]);

  const chartData = useMemo(() => {
    const series = data?.series ?? [];
    const hasComparison = series.some((day) => day.totalAnterior != null);
    const datasets = [
      {
        type: 'bar',
        label: 'Casos no período',
        data: series.map((day) => day.total),
        backgroundColor: meta.color,
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ];
    if (hasComparison) {
      datasets.push({
        type: 'line',
        label: `Comparativo (${formatCompareLabel(data?.comparison?.mode)})`,
        data: series.map((day) => day.totalAnterior ?? null),
        borderColor: '#94a3b8',
        backgroundColor: '#94a3b8',
        borderDash: [6, 4],
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
      });
    }
    return { labels: series.map((day) => day.label), datasets };
  }, [data, meta.color]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: { beginAtZero: true, grid: { display: false } },
        x: { grid: { display: false } },
      },
    }),
    [],
  );

  const motivosPorProduto = data?.motivosPorProduto ?? [];

  return (
    <div className="page active gestao-detail-page" id={`gestao-caso-especial-${orgao}`}>
      <div className="eco-page-inner gestao-detail-page__inner">
        <header className="gestao-detail-page__header">
          <button type="button" className="gestao-detail-page__back" onClick={() => navigate('/workspace')}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar
          </button>
          <div className="gestao-detail-page__title-row">
            <span className="gestao-detail-page__icon" style={{ '--accent': meta.color }}>
              <i className={`ti ${meta.icon}`} aria-hidden="true" />
            </span>
            <div>
              <span className="gestao-detail-page__eyebrow">Casos especiais</span>
              <h2 className="gestao-detail-page__title">{meta.label}</h2>
            </div>
          </div>
          <p className="gestao-insight-card__mock-note">
            <i className="ti ti-info-circle" aria-hidden="true" />
            Dados ilustrativos — aguardando integração dos canais de atendimento especiais.
          </p>
        </header>

        {error ? <p className="gestao-insight-card__error">{error}</p> : null}

        <section className="ws-panel gestao-detail-page__tiles-card">
          <div className="gestao-detail-page__tiles">
            <div className="gestao-detail-page__tile" style={{ '--accent': meta.color }}>
              <span className="gestao-detail-page__tile-value">
                {loading ? '—' : data?.totals?.currentMonth ?? 0}
              </span>
              <span className="gestao-detail-page__tile-label">Casos no mês atual</span>
            </div>
            <div className="gestao-detail-page__tile" style={{ '--accent': meta.color }}>
              <span className="gestao-detail-page__tile-value">
                {loading ? '—' : data?.totals?.currentYear ?? 0}
              </span>
              <span className="gestao-detail-page__tile-label">Casos no ano atual</span>
            </div>
          </div>
        </section>

        <section className="ws-panel gestao-insight-card gestao-detail-page__chart-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-chart-histogram" />
              </span>
              Evolução do período
            </h4>
            <div className="gestao-detail-page__chart-controls">
              <GestaoGranularityToggle value={granularity} onChange={setGranularity} />
              {granularity === 'dia' ? (
                <GestaoPeriodFilter
                  value={period}
                  onChange={setPeriod}
                  idPrefix={`gestao-caso-${orgao}`}
                  showCompare
                  compareValue={compareMode}
                  onCompareChange={setCompareMode}
                />
              ) : (
                <div className="gestao-period-filter__compare" role="group" aria-label="Selecionar comparativo">
                  <button
                    type="button"
                    className={
                      'gestao-period-filter__compare-pill' +
                      (compareMode === '' ? ' gestao-period-filter__compare-pill--active' : '')
                    }
                    onClick={() => setCompareMode('')}
                  >
                    Sem comparativo
                  </button>
                  <button
                    type="button"
                    className={
                      'gestao-period-filter__compare-pill' +
                      (compareMode === 'yoy' ? ' gestao-period-filter__compare-pill--active' : '')
                    }
                    onClick={() => setCompareMode('yoy')}
                  >
                    Ano a ano
                  </button>
                </div>
              )}
            </div>
          </header>

          {granularity === 'mes' ? (
            <p className="gestao-granularity-hint">Meses fechados do ano corrente (jan a {new Date().toLocaleDateString('pt-BR', { month: 'short' })}).</p>
          ) : null}

          <div className="gestao-detail-page__chart-wrap">
            {loading ? (
              <p className="gestao-insight-card__loading">Carregando…</p>
            ) : (
              <Chart type="bar" data={chartData} options={chartOptions} />
            )}
          </div>
        </section>

        <section className="ws-panel gestao-insight-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-list-details" />
              </span>
              Principais motivos por produto
            </h4>
          </header>

          {loading ? (
            <p className="gestao-insight-card__loading">Carregando…</p>
          ) : motivosPorProduto.length === 0 ? (
            <p className="gestao-insight-card__empty">Sem dados para este órgão/canal.</p>
          ) : (
            <div className="gestao-detail-page__produtos-grid">
              {motivosPorProduto.map((produtoEntry) => (
                <div key={produtoEntry.produto} className="gestao-detail-page__produto-card">
                  <div className="gestao-detail-page__produto-head">
                    <span className="gestao-motivos-card__produto">{produtoEntry.produto}</span>
                    <span className="gestao-detail-page__produto-total">{produtoEntry.total} casos</span>
                  </div>
                  <ul className="gestao-detail-page__motivo-list">
                    {produtoEntry.motivos.map((motivo) => (
                      <li key={motivo.motivo} className="gestao-detail-page__motivo-item">
                        <div className="gestao-motivos-card__bar-track">
                          <div
                            className="gestao-motivos-card__bar-fill"
                            style={{ width: `${Math.max(4, motivo.pct)}%` }}
                          />
                        </div>
                        <div className="gestao-detail-page__motivo-labels">
                          <span>{motivo.motivo}</span>
                          <strong>{motivo.pct}%</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="gestao-insight-card__mock-note">
            <i className="ti ti-info-circle" aria-hidden="true" />
            Motivos ilustrativos — os produtos refletem a tabulação real de tickets; a associação por órgão ainda não existe.
          </p>
        </section>
      </div>
    </div>
  );
}
