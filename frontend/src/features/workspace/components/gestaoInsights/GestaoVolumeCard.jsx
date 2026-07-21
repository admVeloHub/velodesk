/**
 * GestaoVolumeCard v1.0.0 — volume diário de tickets (abertos/encerrados) + nota média
 * DATE: 2026-07-17 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
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
import './gestaoInsights.css';

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

/** Plugin local — desenha o valor de cada barra/ponto acima do elemento (sem depender de libs externas). */
const valueLabelsPlugin = {
  id: 'gestaoValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        if (value == null) return;
        const { x, y } = element.getProps(['x', 'y'], true);
        ctx.save();
        ctx.fillStyle = '#272A30';
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(value), x, y - 6);
        ctx.restore();
      });
    });
  },
};

export default function GestaoVolumeCard({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .volume({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o volume de tickets.');
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
          type: 'bar',
          label: 'Abertos',
          data: series.map((day) => day.abertos),
          backgroundColor: '#1634FF',
          borderRadius: 6,
          maxBarThickness: 28,
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Encerrados',
          data: series.map((day) => day.encerrados),
          backgroundColor: '#006AB9',
          borderRadius: 6,
          maxBarThickness: 28,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Nota média',
          data: series.map((day) => day.notaMedia),
          borderColor: '#272A30',
          backgroundColor: '#272A30',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#272A30',
          yAxisID: 'y1',
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
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          position: 'left',
          grid: { display: false },
          title: { display: true, text: 'Tickets' },
        },
        y1: {
          beginAtZero: false,
          min: 0,
          max: 5,
          position: 'right',
          grid: { display: false },
          title: { display: true, text: 'Nota média' },
        },
        x: {
          grid: { display: false },
        },
      },
    }),
    [],
  );

  return (
    <section className="ws-panel gestao-insight-card gestao-volume-card">
      <header className="gestao-insight-card__head">
        <h4>
          <span aria-hidden="true">
            <i className="ti ti-chart-histogram" />
          </span>
          Volume de tickets
        </h4>
      </header>

      {error ? <p className="gestao-insight-card__error">{error}</p> : null}

      <div className="gestao-volume-card__chart-wrap">
        {loading ? (
          <p className="gestao-insight-card__loading">Carregando…</p>
        ) : (
          <Chart type="bar" data={chartData} options={chartOptions} plugins={[valueLabelsPlugin]} />
        )}
      </div>

      <p className="gestao-insight-card__mock-note">
        <i className="ti ti-info-circle" aria-hidden="true" />
        Nota média: dados ilustrativos — aguardando captura real de avaliação do cliente.
      </p>
    </section>
  );
}
