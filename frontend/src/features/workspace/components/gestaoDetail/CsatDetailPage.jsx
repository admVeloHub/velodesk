/**
 * CsatDetailPage v2.0.0 — painel dedicado de CSAT: tabs de mês, KPIs com variação vs. mês
 * anterior, tendência de 7 meses, quebra por canal, funil de envio/resposta e casos avaliados
 * (com filtro por nota e link direto pro ticket original).
 * DATE: 2026-08-25 | AUTHOR: VeloHub Development Team
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js';
import { gestaoInsightsApi } from '../../../../api/client';
import { useTickets } from '../../../../context/TicketsContext';
import './csatDashboard.css';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

function formatNota(value) {
  return value == null ? '—' : Number(value).toFixed(2).replace('.', ',');
}

function formatPct(value) {
  return value == null ? '—' : `${String(value).replace('.', ',')}`;
}

function deltaLabel(delta, unit, previousLabel) {
  if (delta == null) return null;
  if (delta === 0) return { tone: 'flat', text: `= igual a ${previousLabel}` };
  const tone = delta > 0 ? 'up' : 'down';
  const arrow = delta > 0 ? '▲' : '▼';
  const abs = Math.abs(delta).toString().replace('.', ',');
  return { tone, text: `${arrow} ${abs}${unit} vs. ${previousLabel}` };
}

function faixaClass(faixa) {
  if (faixa === 'high') return 'csat-dash__ch-score--high';
  if (faixa === 'mid') return 'csat-dash__ch-score--mid';
  return 'csat-dash__ch-score--low';
}

function notaPillClass(nota) {
  if (nota >= 4) return 'csat-dash__pill--high';
  if (nota === 3) return 'csat-dash__pill--mid';
  return 'csat-dash__pill--low';
}

export default function CsatDetailPage() {
  const navigate = useNavigate();
  const { openTicket } = useTickets();

  const [month, setMonth] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroNota, setFiltroNota] = useState('todas');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    gestaoInsightsApi
      .csatDashboard(month ? { month } : {})
      .then((result) => {
        if (!active) return;
        setData(result);
        if (!month) setMonth(result.selectedMonth);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o painel de CSAT.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleOpenTicket = (ticketId) => {
    if (typeof window.openTicket === 'function') {
      window.openTicket(ticketId);
      return;
    }
    openTicket(ticketId);
    navigate('/tickets?desk=v2');
  };

  const trendChartData = useMemo(() => {
    const series = data?.tendencia ?? [];
    return {
      labels: series.map((m) => m.label),
      datasets: [
        {
          data: series.map((m) => m.notaMedia),
          borderColor: '#1634FF',
          backgroundColor: 'rgba(22,52,255,0.06)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1634FF',
          pointRadius: 4,
          tension: 0.35,
          fill: true,
          spanGaps: true,
        },
      ],
    };
  }, [data]);

  const trendChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: { stepSize: 1, color: '#9AA0AE', font: { family: 'Poppins', size: 11 } },
          grid: { color: '#F0F2F7' },
        },
        x: { ticks: { color: '#9AA0AE', font: { family: 'Poppins', size: 11 } }, grid: { display: false } },
      },
    }),
    [],
  );

  const previousLabel = useMemo(() => {
    const months = data?.months ?? [];
    const idx = months.findIndex((m) => m.key === data?.selectedMonth);
    return idx > 0 ? months[idx - 1].label : 'mês anterior';
  }, [data]);

  const casos = data?.casos ?? [];
  const casosFiltrados = casos.filter((c) => {
    if (filtroNota === 'baixa') return c.nota <= 3;
    if (filtroNota === 'positiva') return c.nota >= 4;
    return true;
  });

  const funilMax = Math.max(1, ...(data?.funil ?? []).map((f) => f.total));

  return (
    <div className="page active csat-dash" id="gestao-csat">
      <div className="eco-page-inner csat-dash__inner">
        <button type="button" className="csat-dash__back" onClick={() => navigate('/workspace')}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Voltar
        </button>

        <div className="csat-dash__eyebrow">Satisfação do cliente</div>
        <h1 className="csat-dash__title">CSAT · Velodesk</h1>
        <p className="csat-dash__sub">
          Nota e comentário coletados no e-mail de encerramento (E5) e na repescagem (E5.2), quebrados por canal em
          que o ticket foi aberto. Cada nota fica também registrada no ticket de origem.
        </p>

        {error ? <p className="csat-dash__error">{error}</p> : null}

        <div className="csat-dash__tabs">
          {(data?.months ?? []).map((m) => (
            <button
              key={m.key}
              type="button"
              className={`csat-dash__tab${m.key === data?.selectedMonth ? ' csat-dash__tab--active' : ''}`}
              onClick={() => setMonth(m.key)}
            >
              {m.label}
              {m.atual ? ' (em aberto)' : ''}
            </button>
          ))}
        </div>

        <div className="csat-dash__kpi-row">
          <div className="csat-dash__kpi">
            <div className="csat-dash__kpi-label">Nota média ponderada</div>
            <div className="csat-dash__kpi-value">
              {formatNota(data?.kpis?.notaMediaPonderada?.value)} <small>/ 5</small>
            </div>
            {(() => {
              const d = deltaLabel(data?.kpis?.notaMediaPonderada?.delta, '', previousLabel);
              return d ? <div className={`csat-dash__kpi-delta csat-dash__kpi-delta--${d.tone}`}>{d.text}</div> : null;
            })()}
          </div>
          <div className="csat-dash__kpi">
            <div className="csat-dash__kpi-label">Taxa de resposta ao CSAT</div>
            <div className="csat-dash__kpi-value">
              {formatPct(data?.kpis?.taxaResposta?.value)}
              <small>%</small>
            </div>
            {(() => {
              const d = deltaLabel(data?.kpis?.taxaResposta?.delta, ' pts', previousLabel);
              return d ? <div className={`csat-dash__kpi-delta csat-dash__kpi-delta--${d.tone}`}>{d.text}</div> : null;
            })()}
          </div>
          <div className="csat-dash__kpi">
            <div className="csat-dash__kpi-label">Notas baixas (1–3)</div>
            <div className="csat-dash__kpi-value">
              {formatPct(data?.kpis?.notasBaixasPct?.value)}
              <small>%</small>
            </div>
            {(() => {
              // Delta positivo em nota baixa é ruim — inverte o tom.
              const raw = data?.kpis?.notasBaixasPct?.delta;
              const d = deltaLabel(raw, ' pts', previousLabel);
              const tone = d ? (d.tone === 'up' ? 'down' : d.tone === 'down' ? 'up' : 'flat') : null;
              return d ? <div className={`csat-dash__kpi-delta csat-dash__kpi-delta--${tone}`}>{d.text}</div> : null;
            })()}
          </div>
          <div className="csat-dash__kpi">
            <div className="csat-dash__kpi-label">Avaliações no período</div>
            <div className="csat-dash__kpi-value">{data?.kpis?.avaliacoesNoPeriodo?.value ?? 0}</div>
            <div className="csat-dash__kpi-footnote">
              de {data?.kpis?.avaliacoesNoPeriodo?.enviados ?? 0} e-mails de CSAT enviados
            </div>
          </div>
        </div>

        <section className="csat-dash__card">
          <h2>Tendência — nota média ponderada (últimos 7 meses)</h2>
          <p className="csat-dash__card-sub">
            Considera E5 e E5.2. Uma queda sustentada por 2+ meses costuma indicar um problema de processo, não um
            caso isolado.
          </p>
          {loading ? (
            <p className="csat-dash__loading">Carregando…</p>
          ) : (
            <div className="csat-dash__chart-wrap">
              <Line data={trendChartData} options={trendChartOptions} />
            </div>
          )}
        </section>

        <section className="csat-dash__card">
          <h2>Por canal de abertura do ticket</h2>
          <p className="csat-dash__card-sub">
            O CSAT é o mesmo e-mail para todos — o que muda é o canal pelo qual o ticket entrou originalmente.
          </p>
          {loading ? (
            <p className="csat-dash__loading">Carregando…</p>
          ) : (data?.porCanal ?? []).length === 0 ? (
            <p className="csat-dash__empty">Nenhuma resposta de CSAT vinculada a um canal neste mês.</p>
          ) : (
            <div className="csat-dash__channel-grid">
              {data.porCanal.map((ch) => (
                <div className="csat-dash__channel" key={ch.canal}>
                  <div className="csat-dash__ch-name">{ch.canal}</div>
                  <div className={`csat-dash__ch-score ${faixaClass(ch.faixa)}`}>{formatNota(ch.notaMedia)}</div>
                  <div className="csat-dash__ch-count">{ch.respostas} respostas</div>
                  {ch.notasBaixas > 0 ? (
                    <div className="csat-dash__ch-baixas">{ch.notasBaixas} notas baixas</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="csat-dash__card">
          <h2>Envio e resposta (funil do período)</h2>
          <p className="csat-dash__card-sub">Do ticket fechado até o comentário escrito — onde as pessoas estão saindo.</p>
          {loading ? (
            <p className="csat-dash__loading">Carregando…</p>
          ) : (
            (data?.funil ?? []).map((step) => (
              <div className="csat-dash__resp-row" key={step.label}>
                <div className="csat-dash__resp-label">{step.label}</div>
                <div className="csat-dash__resp-bar-bg">
                  <div
                    className="csat-dash__resp-bar-fill"
                    style={{ width: step.total > 0 ? `${Math.max(2, (step.total / funilMax) * 100)}%` : '0%' }}
                  />
                </div>
                <div className="csat-dash__resp-pct">{step.total}</div>
              </div>
            ))
          )}
        </section>

        <section className="csat-dash__card">
          <h2>Casos avaliados — mais recentes</h2>
          <p className="csat-dash__card-sub">Clique em “Ver ticket” para abrir o chamado original com o histórico completo da conversa.</p>
          <div className="csat-dash__filtro-notas">
            <button
              type="button"
              className={`csat-dash__filtro-btn${filtroNota === 'todas' ? ' csat-dash__filtro-btn--todas' : ''}`}
              onClick={() => setFiltroNota('todas')}
            >
              Todas as notas
            </button>
            <button
              type="button"
              className={`csat-dash__filtro-btn${filtroNota === 'baixa' ? ' csat-dash__filtro-btn--baixa' : ''}`}
              onClick={() => setFiltroNota('baixa')}
            >
              Notas baixas (1–3)
            </button>
            <button
              type="button"
              className={`csat-dash__filtro-btn${filtroNota === 'positiva' ? ' csat-dash__filtro-btn--positiva' : ''}`}
              onClick={() => setFiltroNota('positiva')}
            >
              Notas positivas (4–5)
            </button>
          </div>
          <div className="csat-dash__table-wrap">
            <table className="csat-dash__table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data</th>
                  <th>Canal</th>
                  <th>Nota</th>
                  <th>Comentário</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="csat-dash__table-empty">Carregando…</td>
                  </tr>
                ) : casosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="csat-dash__table-empty">Nenhum caso avaliado neste mês.</td>
                  </tr>
                ) : (
                  casosFiltrados.map((c) => (
                    <tr key={c.id}>
                      <td className="csat-dash__proto">{c.protocolo}</td>
                      <td>{c.respondidoEm ? new Date(c.respondidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</td>
                      <td>{c.canal ? <span className="csat-dash__canal-tag">{c.canal}</span> : '—'}</td>
                      <td><span className={`csat-dash__pill ${notaPillClass(c.nota)}`}>{c.nota}</span></td>
                      <td className="csat-dash__comentario">
                        {c.comentario ? `"${c.comentario}"` : <span className="csat-dash__sem-comentario">Sem comentário escrito</span>}
                      </td>
                      <td>
                        <button type="button" className="csat-dash__ver-ticket" onClick={() => handleOpenTicket(c.id)}>
                          Ver ticket
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="csat-dash__footnote">
            Mostrando {casosFiltrados.length} de {casos.length} avaliações carregadas neste mês.
          </p>
        </section>
      </div>
    </div>
  );
}
