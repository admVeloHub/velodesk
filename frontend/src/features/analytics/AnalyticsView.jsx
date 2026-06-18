/**
 * Analytics IA
 * VERSION: v2.0.0 | DATE: 2026-06-18
 */
import React, { useEffect, useRef } from 'react';

const HEATMAP = ['Cobrança', 'Lentidão', 'Cancelamento', 'Instalação', 'Sinal'];

export default function AnalyticsView() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window.Chart === 'undefined') return;
    if (canvas._chart) canvas._chart.destroy();
    canvas._chart = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        datasets: [
          { label: 'Real', data: [980, 1100, 1050, 1200, 1150, 400, 300], borderColor: '#1634FF', tension: 0.3 },
          { label: 'Previsto', data: [null, null, null, null, 1150, 520, 380], borderColor: '#f59e0b', borderDash: [5, 5], tension: 0.3 }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
    });
    return () => { if (canvas._chart) canvas._chart.destroy(); };
  }, []);

  return (
    <div id="analytics-ia" className="page eco-page active">
      <div className="page-header"><h2>Analytics IA</h2></div>
      <div className="eco-page-inner eco-stagger" id="analyticsIAContent">
        <div className="ws-hero ws-hero--mgmt">
          <div><span className="ws-eyebrow">Analytics & Gestão</span><h3>Dashboard executivo em tempo real</h3><p>TMA, SLA, NPS e previsões atualizados continuamente.</p></div>
          <div className="analytics-filters">
            <select id="analyticsPeriod"><option>Hoje</option><option>7 dias</option><option>30 dias</option></select>
            <select><option>Todos os produtos</option><option>Internet</option><option>Móvel</option></select>
          </div>
        </div>
        <div className="ws-stats-grid ws-stats-grid--6">
          {[
            ['fa-stopwatch', '4m 12s', 'TMA'],
            ['fa-hourglass-half', '6m 45s', 'TME'],
            ['fa-check-double', '76%', 'FCR'],
            ['fa-smile', '72', 'NPS'],
            ['fa-percentage', '91%', 'SLA'],
            ['fa-phone-volume', '1.247', 'Volume']
          ].map(([icon, val, label]) => (
            <div key={label} className="ws-stat-card"><i className={'fas ' + icon} /><strong>{val}</strong><span>{label}</span></div>
          ))}
        </div>
        <div className="ws-grid-2">
          <section className="ws-panel">
            <h4><i className="fas fa-fire" /> Mapa de reclamações (calor)</h4>
            <div className="heatmap">
              {HEATMAP.map((r, i) => (
                <div key={r} className="heatmap-row">
                  <span>{r}</span>
                  <div className="heatmap-cells">
                    {[40, 90, 30, 70, 55].map((v, j) => (
                      <div key={j} className="heatmap-cell" style={{ '--intensity': v + i * 5 }} title={`${v}%`}>{v}%</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="ws-panel">
            <h4><i className="fas fa-chart-area" /> Previsão de volume (IA)</h4>
            <canvas ref={canvasRef} id="volumePredictionChart" height="200" />
            <p className="forms-toolbar-hint">Pico previsto: amanhã 14h–17h (+18%). Escale 3 agentes extras.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
