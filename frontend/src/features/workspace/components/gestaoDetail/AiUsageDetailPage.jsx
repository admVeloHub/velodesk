/**
 * AiUsageDetailPage v1.0.0 — detalhe de custo de IA (tokens): totais mês/ano, gráfico comparativo
 * (MoM/YoY) e breakdowns por IA, por colaborador e por produto.
 * DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
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
import { aiUsageApi } from '../../../../api/client';
import GestaoPeriodFilter from '../gestaoInsights/GestaoPeriodFilter';
import GestaoGranularityToggle from '../gestaoInsights/GestaoGranularityToggle';
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

const PROVIDER_LABELS = { openai: 'OpenAI', gemini: 'Gemini' };

function formatUsd(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatTokens(value) {
  return Number(value ?? 0).toLocaleString('pt-BR');
}

function formatCompareLabel(mode) {
  if (mode === 'mom') return 'período imediatamente anterior';
  if (mode === 'yoy') return 'mesmo período do ano anterior';
  return '';
}

function formatDeltaPct(deltaPct) {
  if (deltaPct == null) return null;
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${deltaPct}%`;
}

export default function AiUsageDetailPage() {
  const navigate = useNavigate();

  const [period, setPeriod] = useState({ period: 'mes' });
  const [compareMode, setCompareMode] = useState('');
  const [granularity, setGranularity] = useState('dia');
  const [data, setData] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breakdownView, setBreakdownView] = useState('model');

  useEffect(() => {
    aiUsageApi.totals().then(setTotals).catch(() => setTotals(null));
  }, []);

  useEffect(() => {
    if (granularity === 'mes' && compareMode === 'mom') setCompareMode('');
  }, [granularity, compareMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    aiUsageApi
      .report({
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
        if (active) setError('Não foi possível carregar o relatório de custo de IA.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to, compareMode, granularity]);

  const chartData = useMemo(() => {
    const series = data?.series ?? [];
    const datasets = [
      {
        type: 'bar',
        label: 'OpenAI',
        data: series.map((day) => day.openaiCostUsd),
        backgroundColor: '#1634FF',
        borderRadius: 4,
        maxBarThickness: 28,
        stack: 'cost',
      },
      {
        type: 'bar',
        label: 'Gemini',
        data: series.map((day) => day.geminiCostUsd),
        backgroundColor: '#FCC200',
        borderRadius: 4,
        maxBarThickness: 28,
        stack: 'cost',
      },
    ];
    if (data?.comparison?.series?.length) {
      datasets.push({
        type: 'line',
        label: `Comparativo (${formatCompareLabel(data.comparison.mode)})`,
        data: data.comparison.series.map((day) => day.totalCostUsd),
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
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatUsd(ctx.parsed.y)}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          stacked: true,
          grid: { display: false },
          ticks: { callback: (value) => formatUsd(value) },
        },
        x: { stacked: true, grid: { display: false } },
      },
    }),
    [],
  );

  const summary = data?.summary;
  const comparison = data?.comparison;

  const breakdownOptions = {
    model: { label: 'Por IA', rows: data?.byModel ?? [] },
    colaborador: { label: 'Por colaborador', rows: data?.byColaborador ?? [] },
    produto: { label: 'Por produto', rows: data?.byProduto ?? [] },
  };
  const activeBreakdown = breakdownOptions[breakdownView] ?? breakdownOptions.model;

  function rowLabel(row) {
    if (breakdownView === 'model') {
      return `${PROVIDER_LABELS[row.provider] ?? row.provider} · ${row.model}`;
    }
    if (breakdownView === 'colaborador') return row.label;
    return row.produto;
  }

  function rowKey(row) {
    if (breakdownView === 'model') return `${row.provider}:${row.model}`;
    if (breakdownView === 'colaborador') return row.key;
    return row.produto;
  }

  return (
    <div className="page active gestao-detail-page" id="gestao-custo-ia">
      <div className="eco-page-inner gestao-detail-page__inner">
        <header className="gestao-detail-page__header">
          <button type="button" className="gestao-detail-page__back" onClick={() => navigate('/workspace')}>
            <i className="ti ti-arrow-left" aria-hidden="true" />
            Voltar
          </button>
          <div className="gestao-detail-page__title-row">
            <span className="gestao-detail-page__icon" style={{ '--accent': '#1634FF' }}>
              <i className="ti ti-cpu" aria-hidden="true" />
            </span>
            <div>
              <span className="gestao-detail-page__eyebrow">Custo de IA</span>
              <h2 className="gestao-detail-page__title">Custo de IA (tokens)</h2>
            </div>
          </div>
          <p className="gestao-insight-card__mock-note">
            <i className="ti ti-info-circle" aria-hidden="true" />
            Custos estimados por tabela de preço pública dos provedores — não substituem a fatura real.
          </p>
        </header>

        {error ? <p className="gestao-insight-card__error">{error}</p> : null}

        <section className="ws-panel gestao-detail-page__tiles-card">
          <div className="gestao-detail-page__tiles">
            <div className="gestao-detail-page__tile" style={{ '--accent': '#1634FF' }}>
              <span className="gestao-detail-page__tile-value">{formatUsd(totals?.currentMonth)}</span>
              <span className="gestao-detail-page__tile-label">Custo no mês atual</span>
            </div>
            <div className="gestao-detail-page__tile" style={{ '--accent': '#FCC200' }}>
              <span className="gestao-detail-page__tile-value">{formatUsd(totals?.currentYear)}</span>
              <span className="gestao-detail-page__tile-label">Custo no ano atual</span>
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
                  idPrefix="gestao-ai-usage-detail"
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

          {loading ? (
            <p className="gestao-insight-card__loading">Carregando…</p>
          ) : (
            <>
              <div className="ai-usage-card__tiles">
                <div className="ai-usage-card__tile">
                  <span className="ai-usage-card__tile-value">{formatUsd(summary?.totalCostUsd)}</span>
                  <span className="ai-usage-card__tile-label">Custo no período</span>
                </div>
                <div className="ai-usage-card__tile">
                  <span className="ai-usage-card__tile-value">{formatUsd(summary?.avgDailyCostUsd)}</span>
                  <span className="ai-usage-card__tile-label">Média diária</span>
                </div>
                <div className="ai-usage-card__tile ai-usage-card__tile--forecast">
                  <span className="ai-usage-card__tile-value">{formatUsd(summary?.projectedMonthlyCostUsd)}</span>
                  <span className="ai-usage-card__tile-label">Projeção mensal</span>
                </div>
                <div className="ai-usage-card__tile">
                  <span className="ai-usage-card__tile-value">{formatTokens(summary?.totalTokens)}</span>
                  <span className="ai-usage-card__tile-label">Tokens ({formatTokens(summary?.totalCalls)} chamadas)</span>
                </div>
                {comparison ? (
                  <div className="ai-usage-card__tile ai-usage-card__tile--compare">
                    <span className="ai-usage-card__tile-value">
                      {formatDeltaPct(comparison.deltaPct) ?? '—'}
                    </span>
                    <span className="ai-usage-card__tile-label">
                      vs. {formatCompareLabel(comparison.mode)} ({formatUsd(comparison.totalCostUsd)})
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="gestao-detail-page__chart-wrap">
                <Chart type="bar" data={chartData} options={chartOptions} />
              </div>
            </>
          )}
        </section>

        <section className="ws-panel gestao-insight-card">
          <header className="gestao-insight-card__head">
            <h4>
              <span aria-hidden="true">
                <i className="ti ti-users" />
              </span>
              Breakdown de custo
            </h4>
          </header>

          <div className="ai-usage-card__breakdown-tabs">
            {Object.entries(breakdownOptions).map(([key, opt]) => (
              <button
                key={key}
                type="button"
                className={breakdownView === key ? 'is-active' : ''}
                onClick={() => setBreakdownView(key)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <table className="ai-usage-card__table">
            <thead>
              <tr>
                <th>{activeBreakdown.label}</th>
                <th>Chamadas</th>
                <th>Tokens</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="ai-usage-card__table-empty">Carregando…</td>
                </tr>
              ) : activeBreakdown.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ai-usage-card__table-empty">Sem uso de IA registrado no período.</td>
                </tr>
              ) : (
                activeBreakdown.rows.map((row) => (
                  <tr key={rowKey(row)}>
                    <td>{rowLabel(row)}</td>
                    <td>{formatTokens(row.calls)}</td>
                    <td>{formatTokens(row.tokens)}</td>
                    <td>{formatUsd(row.costUsd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
