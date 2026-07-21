/**
 * AiUsageCostCard v1.0.0 — custo diário de tokens de IA (OpenAI/Gemini) para previsão de gastos
 * DATE: 2026-07-21 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { aiUsageApi } from '../../../../api/client';
import GestaoPeriodFilter from '../gestaoInsights/GestaoPeriodFilter';
import './aiUsage.css';

ChartJS.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

const FEATURE_LABELS = {
  atendimento: 'Atendimento (resposta sugerida)',
  auditoria: 'Auditoria de resposta',
  gestao_chamados: 'Gestão de chamados (ciclo horário)',
  ticket_suggest_legacy: 'Sugestão de ticket (legado)',
  refinar_rascunho: 'Refinar rascunho',
};

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  gemini: 'Gemini',
};

function formatUsd(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatTokens(value) {
  const n = Number(value ?? 0);
  return n.toLocaleString('pt-BR');
}

/** Plugin local — escreve o custo total do dia acima da barra empilhada. */
const totalLabelsPlugin = {
  id: 'aiUsageTotalLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const datasets = chart.data.datasets;
    if (!datasets.length) return;
    const lastVisibleIndex = datasets.length - 1;
    const meta = chart.getDatasetMeta(lastVisibleIndex);
    if (!meta || meta.hidden) return;
    meta.data.forEach((element, index) => {
      const total = datasets.reduce((sum, ds) => sum + (Number(ds.data[index]) || 0), 0);
      if (!total) return;
      const { x, y } = element.getProps(['x', 'y'], true);
      ctx.save();
      ctx.fillStyle = '#272A30';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatUsd(total), x, y - 6);
      ctx.restore();
    });
  },
};

export default function AiUsageCostCard() {
  const [period, setPeriod] = useState({ period: 'mes' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [breakdownView, setBreakdownView] = useState('feature');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    aiUsageApi
      .report({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o custo de IA.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

  const chartData = useMemo(() => {
    const series = data?.series ?? [];
    return {
      labels: series.map((day) => day.label),
      datasets: [
        {
          label: 'OpenAI',
          data: series.map((day) => day.openaiCostUsd),
          backgroundColor: '#1634FF',
          borderRadius: 4,
          maxBarThickness: 28,
          stack: 'cost',
        },
        {
          label: 'Gemini',
          data: series.map((day) => day.geminiCostUsd),
          backgroundColor: '#FCC200',
          borderRadius: 4,
          maxBarThickness: 28,
          stack: 'cost',
        },
      ],
    };
  }, [data]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 22 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatUsd(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          stacked: true,
          grid: { display: false },
          ticks: { callback: (value) => formatUsd(value) },
        },
        x: {
          stacked: true,
          grid: { display: false },
        },
      },
    }),
    [],
  );

  const summary = data?.summary;
  const breakdown = breakdownView === 'feature' ? data?.byFeature ?? [] : data?.byModel ?? [];

  return (
    <section className="ws-panel gestao-insight-card ai-usage-card">
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-cpu" />
          </span>
          Custo de IA (tokens)
        </h4>
        <GestaoPeriodFilter value={period} onChange={setPeriod} idPrefix="gestao-ai-usage" />
      </header>

      {error ? <p className="gestao-insight-card__error">{error}</p> : null}

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
          </div>

          <div className="ai-usage-card__chart-wrap">
            <Chart type="bar" data={chartData} options={chartOptions} plugins={[totalLabelsPlugin]} />
          </div>

          <div className="ai-usage-card__breakdown">
            <div className="ai-usage-card__breakdown-tabs">
              <button
                type="button"
                className={breakdownView === 'feature' ? 'is-active' : ''}
                onClick={() => setBreakdownView('feature')}
              >
                Por recurso
              </button>
              <button
                type="button"
                className={breakdownView === 'model' ? 'is-active' : ''}
                onClick={() => setBreakdownView('model')}
              >
                Por modelo
              </button>
            </div>

            <table className="ai-usage-card__table">
              <thead>
                <tr>
                  <th>{breakdownView === 'feature' ? 'Recurso' : 'Modelo'}</th>
                  <th>Chamadas</th>
                  <th>Tokens</th>
                  <th>Custo</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="ai-usage-card__table-empty">
                      Sem uso de IA registrado no período.
                    </td>
                  </tr>
                ) : (
                  breakdown.map((row) => (
                    <tr key={breakdownView === 'feature' ? row.feature : `${row.provider}:${row.model}`}>
                      <td>
                        {breakdownView === 'feature'
                          ? FEATURE_LABELS[row.feature] ?? row.feature
                          : `${PROVIDER_LABELS[row.provider] ?? row.provider} · ${row.model}`}
                        {breakdownView === 'model' && row.fallbackPricing ? (
                          <span className="ai-usage-card__badge" title="Modelo fora do catálogo de preços — custo estimado por aproximação">
                            estimado
                          </span>
                        ) : null}
                      </td>
                      <td>{formatTokens(row.calls)}</td>
                      <td>{formatTokens(row.tokens)}</td>
                      <td>{formatUsd(row.costUsd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="gestao-insight-card__mock-note">
            <i className="ti ti-info-circle" aria-hidden="true" />
            Custos estimados por tabela de preço pública dos provedores — não substituem a fatura real.
          </p>
        </>
      )}
    </section>
  );
}
