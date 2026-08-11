/**
 * RealtimeDashboard — corpo do painel operacional (telefonia + tickets + aderência)
 * Visual inspirado no Telão/Realtime do WFM: cards minimalistas com breakdown por fila,
 * tempos máximos combinados, notas com estrelas e nomes de agentes sob demanda.
 */
import React, { useState } from 'react';

export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDecimal(value) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

export function formatTicketTma(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Top filas por contagem (total/atendidas/abandonadas), com % opcional do total do card. */
export function breakdownByCount(rows, key, totalForPct, limit = 4) {
  return (rows ?? [])
    .filter((row) => (row?.[key] ?? 0) > 0)
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, limit)
    .map((row) => ({
      label: row.label,
      value: String(row[key]),
      pct: totalForPct ? Math.round((row[key] / totalForPct) * 100) : undefined,
    }));
}

/** Top filas por duração (tmaSec/maxWaitSec/maxTalkSec) — sem %, valor formatado hh:mm:ss. */
export function breakdownByDuration(rows, key, limit = 2) {
  return (rows ?? [])
    .filter((row) => row?.[key] != null)
    .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
    .slice(0, limit)
    .map((row) => ({ label: row.label, value: formatDuration(row[key]) }));
}

export function Stars() {
  return <span className="realtime-metric__stars">★ ★ ★ ★ ★</span>;
}

export function MetricCard({ label, value, sub, tone = 'navy', breakdown, stars = false, children }) {
  return (
    <div className={`realtime-metric realtime-metric--${tone}`}>
      <span className="realtime-metric__label">{label}</span>
      <strong className="realtime-metric__value">{value ?? '—'}</strong>
      {stars ? <Stars /> : null}
      {sub ? <span className="realtime-metric__sub">{sub}</span> : null}
      {breakdown && breakdown.length > 0 ? (
        <ul className="realtime-metric__breakdown">
          {breakdown.map((item) => (
            <li key={item.label}>
              <span className="realtime-metric__breakdown-label">
                <span className="realtime-metric__breakdown-dot" />
                <span>{item.label}</span>
              </span>
              <span className="realtime-metric__breakdown-value">
                {item.value}
                {item.pct != null ? ` (${item.pct}%)` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

export function CombinedTimesCard({ maxWait, maxTalk, waitBreakdown, talkBreakdown }) {
  const hasBreakdown = (waitBreakdown?.length ?? 0) > 0 || (talkBreakdown?.length ?? 0) > 0;
  return (
    <div className="realtime-combined-card">
      <p className="realtime-combined-card__title">Tempos máximos</p>
      <div className="realtime-combined-card__grid">
        <div>
          <p className="realtime-combined-card__label">Máx. espera</p>
          <p className="realtime-combined-card__value">{maxWait}</p>
        </div>
        <div>
          <p className="realtime-combined-card__label">Máx. chamada</p>
          <p className="realtime-combined-card__value">{maxTalk}</p>
        </div>
      </div>
      {hasBreakdown ? (
        <div className="realtime-combined-card__breakdown">
          {(waitBreakdown ?? []).map((item) => (
            <span key={`w-${item.label}`}>
              {item.label}: <strong>{item.value}</strong>
            </span>
          ))}
          {(talkBreakdown ?? []).map((item) => (
            <span key={`t-${item.label}`}>
              {item.label}: <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EmployeesToggle({ employees, showChamadas = false }) {
  const [open, setOpen] = useState(false);
  const list = employees ?? [];
  if (list.length === 0) return null;

  return (
    <div className="realtime-employees-toggle">
      <button type="button" className="realtime-employees-toggle__btn" onClick={() => setOpen((v) => !v)}>
        {open ? 'Ocultar nomes ▲' : `Ver nomes (${list.length}) ▾`}
      </button>
      {open ? (
        <ul className="realtime-employees-toggle__list">
          {list.map((employee) => (
            <li key={employee.id}>
              <span>{employee.nome}</span>
              {showChamadas ? <span>{employee.chamadas ?? 0}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function UnavailableBlock({ message }) {
  return <div className="realtime-unavailable">{message}</div>;
}

export function MotivosList({ title, rows, emptyMessage, limit = 5 }) {
  const limited = (rows ?? []).slice(0, limit);
  return (
    <div className="realtime-ia-motivos__block">
      <div className="realtime-ia-motivos__subtitle">{title}</div>
      {limited.length === 0 ? (
        <p className="realtime-webhook-hint">{emptyMessage}</p>
      ) : (
        limited.map((row) => (
          <div key={row.motivo} className="realtime-ia-motivos__row">
            <span>
              {row.motivo}
              {row.novo ? ' · novo' : ''}
            </span>
            <span>
              {row.tickets} ({row.pct}%)
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default function RealtimeDashboard({ data, onRefreshIa, refreshingIa, iaRefreshMessage }) {
  if (!data) return null;

  const telephony = data.telephony;
  const tickets = data.tickets;
  const adherence = data.adherence;
  const liveCalls = data.liveCalls ?? [];
  const analiseIa = data.analiseIa ?? {};
  const webhookHealth = data.webhookHealth;

  const attendancePct =
    telephony?.total > 0 ? ((telephony.atendidas / telephony.total) * 100).toFixed(1) : '0.0';
  const abandonPct =
    telephony?.total > 0 ? ((telephony.abandonadas / telephony.total) * 100).toFixed(1) : '0.0';
  const leticiaPct =
    telephony?.total > 0 ? (((telephony.leticia ?? 0) / telephony.total) * 100).toFixed(1) : '0.0';

  const porFila = telephony?.porFila ?? [];
  const processadasBreakdown = [
    { label: 'Abandonadas', value: String(telephony?.abandonadas ?? 0) },
    ...breakdownByCount(porFila, 'total', telephony?.total, 3),
  ];
  const atendidasBreakdown = breakdownByCount(porFila, 'atendidas', telephony?.atendidas, 3);
  const esperaBreakdown = (telephony?.emEsperaPorFila ?? []).slice(0, 3);
  const waitTimeBreakdown = breakdownByDuration(porFila, 'maxWaitSec', 2);
  const talkTimeBreakdown = breakdownByDuration(porFila, 'maxTalkSec', 2);

  return (
    <>
      <div className="realtime-grid">
        <section className="realtime-section">
          <div className="realtime-section__header">
            <span className="realtime-section__icon">
              <i className="ti ti-phone-call" aria-hidden="true" />
            </span>
            <h2>Telefonia</h2>
            <span className="realtime-section__live">
              <span
                className={`realtime-section__live-dot${webhookHealth?.emSilencio ? ' realtime-section__live-dot--alert' : ''}`}
              />
              55PBX
            </span>
          </div>

          {data.telephonyUnavailable ? (
            <UnavailableBlock message="Supabase WFM não configurado. Defina REALTIME_SUPABASE_URL e REALTIME_SUPABASE_SERVICE_ROLE_KEY." />
          ) : (
            <>
              <div className="realtime-metrics realtime-metrics--telephony-primary">
                <MetricCard
                  label="Processadas"
                  value={telephony?.total}
                  sub="chamadas hoje"
                  tone="navy"
                  breakdown={processadasBreakdown}
                />
                <MetricCard
                  label="Atendidas"
                  value={telephony?.atendidas}
                  sub={`↑ ${attendancePct}%`}
                  tone="green"
                  breakdown={atendidasBreakdown}
                />
                <MetricCard
                  label="Letícia IA"
                  value={telephony?.leticia}
                  sub={`${leticiaPct}% redirecionadas`}
                  tone="leticia"
                />
                <MetricCard
                  label="Abandonadas"
                  value={telephony?.abandonadas}
                  sub={`${abandonPct}%`}
                  tone="red"
                />
                <MetricCard
                  label="Em espera"
                  value={telephony?.emEspera}
                  sub={telephony?.emEspera === 1 ? '1 aguardando' : `${telephony?.emEspera ?? 0} aguardando`}
                  tone="red"
                  breakdown={esperaBreakdown}
                />
                <MetricCard label="TMA" value={formatDuration(telephony?.tmaSec)} sub="Receptivo" tone="sky" />
              </div>

              <div className="realtime-metrics realtime-metrics--telephony-secondary" style={{ marginTop: '0.5rem' }}>
                <CombinedTimesCard
                  maxWait={formatDuration(telephony?.maxWaitSec)}
                  maxTalk={formatDuration(telephony?.maxTalkSec)}
                  waitBreakdown={waitTimeBreakdown}
                  talkBreakdown={talkTimeBreakdown}
                />
                <MetricCard
                  label="Nota atendente"
                  value={formatDecimal(telephony?.notaAtendente)}
                  tone="yellow"
                  stars
                />
                <MetricCard label="Nota solução" value={formatDecimal(telephony?.notaSolucao)} tone="electric" stars />
                <MetricCard label="Retidas URA" value={telephony?.retidasUra} sub="sem transferência" tone="slate" />
              </div>

              <div className="realtime-live-calls">
                <div className="realtime-live-calls__title">
                  Em atendimento agora ({liveCalls.length})
                  <span className="realtime-live-badge">
                    <span className="realtime-live-badge__dot" />
                    Ao vivo
                  </span>
                </div>
                {webhookHealth?.emSilencio ? (
                  <p className="realtime-webhook-hint realtime-webhook-hint--silent">
                    Webhook em silêncio há mais de 45 min — verifique ingestão 55PBX.
                  </p>
                ) : (
                  <p className="realtime-webhook-hint">
                    Eventos hoje: {webhookHealth?.eventsToday ?? '—'} · últimos 45 min:{' '}
                    {webhookHealth?.eventsLast45Min ?? '—'}
                  </p>
                )}
                {liveCalls.length === 0 ? (
                  <p className="realtime-live-calls__empty">Nenhuma chamada em curso no momento.</p>
                ) : (
                  <div className="realtime-live-calls__table-wrap">
                    <table className="realtime-live-calls__table">
                      <thead>
                        <tr>
                          <th>Atendente</th>
                          <th>Fila</th>
                          <th>Tempo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveCalls.map((call) => (
                          <tr key={call.callId}>
                            <td>{call.agentLabel || 'Agente'}</td>
                            <td>{call.queueLabel}</td>
                            <td>{formatDuration(call.durationSec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="realtime-section">
          <div className="realtime-section__header">
            <span className="realtime-section__icon">
              <i className="ti ti-ticket" aria-hidden="true" />
            </span>
            <h2>Tickets</h2>
            <span className="realtime-section__badge">Total hoje: {tickets?.total ?? 0}</span>
          </div>

          {data.ticketsUnavailable ? (
            <UnavailableBlock message="MongoDB indisponível — métricas de tickets não carregadas." />
          ) : (
            <>
              <p className="realtime-webhook-hint">Abertos hoje · exceto cancelados</p>

              <div className="realtime-status-bar">
                {[
                  { label: 'Em andamento', value: tickets?.andamento, tone: 'sky' },
                  { label: 'Pendente', value: tickets?.pendente, tone: 'red' },
                  { label: 'Resolvido', value: tickets?.resolvido, tone: 'green' },
                  { label: 'Cancelado', value: tickets?.cancelado, tone: 'slate' },
                ].map((item) => (
                  <div key={item.label} className={`realtime-status-bar__item realtime-status-bar__item--${item.tone}`}>
                    <strong>{item.value ?? 0}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="realtime-metrics">
                <MetricCard
                  label="Total a tratar"
                  value={tickets?.totalATratarIndisponivel ? '—' : tickets?.totalATratar}
                  sub="Novo + Pendente + Em andamento"
                  tone="red"
                />
                <MetricCard label="Tratados hoje" value={tickets?.resolvido} sub="Resolvidos" tone="green" />
                <MetricCard
                  label="TMA tickets"
                  value={formatTicketTma(tickets?.tmaUteisMin)}
                  sub="Tempo médio"
                  tone="navy"
                  breakdown={(tickets?.tmaUteisPorCanal ?? []).slice(0, 3)}
                />
                <MetricCard
                  label="1ª resposta"
                  value={formatTicketTma(tickets?.primeiraRespostaUteisMin)}
                  sub="Tempo médio"
                  tone="sky"
                />
                <MetricCard
                  label="Nota satisfação"
                  value={tickets?.satisfacao != null ? formatDecimal(tickets.satisfacao) : '—'}
                  sub={tickets?.satisfacaoLabel}
                  tone="yellow"
                />
                <MetricCard
                  label="Novo · canais"
                  value={tickets?.novo}
                  sub="Aguardando triagem"
                  tone="slate"
                  breakdown={(tickets?.novoPorCanal ?? []).slice(0, 3)}
                />
              </div>

              <div className="realtime-ia-motivos">
                <div className="realtime-ia-motivos__header">
                  <i className="ti ti-sparkles" aria-hidden="true" />
                  Motivos de acionamento (IA)
                  {onRefreshIa ? (
                    <button
                      type="button"
                      className="realtime-ia-motivos__refresh"
                      onClick={onRefreshIa}
                      disabled={refreshingIa}
                      title="Rodar ciclo de classificação IA agora"
                    >
                      <i className={`ti ti-refresh${refreshingIa ? ' ti-spin' : ''}`} aria-hidden="true" />
                      <span>{refreshingIa ? 'Atualizando…' : 'Atualizar análise'}</span>
                    </button>
                  ) : null}
                </div>
                <p className="realtime-webhook-hint">
                  {analiseIa.baseClassificada ?? 0} classificados · {analiseIa.candidatosComTexto ?? 0} elegíveis
                  {(analiseIa.ligacoesLeticiaDoDia ?? 0) > 0
                    ? ` · ${analiseIa.ligacoesLeticiaClassificadas ?? 0}/${analiseIa.ligacoesLeticiaDoDia} Letícia IA`
                    : ''}
                  {analiseIa.ultimaAtualizacaoIa
                    ? ` · atualizado ${new Date(analiseIa.ultimaAtualizacaoIa).toLocaleTimeString('pt-BR')}`
                    : ''}
                </p>
                {iaRefreshMessage ? <p className="realtime-webhook-hint">{iaRefreshMessage}</p> : null}
                <div className="realtime-ia-motivos__columns">
                  <MotivosList
                    title="Tickets"
                    rows={analiseIa.motivosTickets}
                    emptyMessage="Nenhum ticket classificado ainda hoje."
                  />
                  <MotivosList
                    title="Letícia IA"
                    rows={analiseIa.motivosLeticia}
                    emptyMessage="Nenhuma ligação classificada ainda hoje."
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="realtime-section realtime-adherence">
        <div className="realtime-section__header">
          <span className="realtime-section__icon">
            <i className="ti ti-users" aria-hidden="true" />
          </span>
          <h2>Aderência · Atendimento</h2>
          <span className="realtime-section__live">
            <span className="realtime-section__live-dot" />
            Ao vivo
          </span>
        </div>

        {data.adherenceUnavailable ? (
          <UnavailableBlock message="Aderência indisponível — Supabase WFM não configurado." />
        ) : (
          <div className="realtime-metrics">
            <MetricCard label="Escalados hoje" value={adherence?.escalados} tone="navy">
              <EmployeesToggle employees={adherence?.escaladosNomes} showChamadas />
            </MetricCard>
            <MetricCard label="Logados agora" value={adherence?.logados} tone="green">
              <EmployeesToggle employees={adherence?.logadosNomes} />
            </MetricCard>
            <MetricCard label="No horário" value={adherence?.noHorario} tone="green">
              <EmployeesToggle employees={adherence?.noHorarioNomes} />
            </MetricCard>
            <MetricCard label="Atrasados" value={adherence?.atrasados} tone="yellow">
              <EmployeesToggle employees={adherence?.atrasadosNomes} />
            </MetricCard>
            <MetricCard label="Ausentes" value={adherence?.ausentes} tone="red">
              <EmployeesToggle employees={adherence?.ausentesNomes} />
            </MetricCard>
            <MetricCard label="Folga / Fora" value={adherence?.folgaFora} tone="slate">
              <EmployeesToggle employees={adherence?.folgaForaNomes} />
            </MetricCard>
          </div>
        )}
      </section>
    </>
  );
}
