/**
 * Leaderboard operacional — painel supervisor
 * VERSION: v5.1.0 | DATE: 2026-08-12
 * — Oculta filtros turno/canal quando o payload não traz esses campos
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  filterOperationalLeaderboard,
  LEADERBOARD_CHANNEL_OPTIONS,
  LEADERBOARD_SHIFT_OPTIONS,
} from '../../../../services/workspace/deskData';
import { fetchWorkspace360Leaderboard } from '../../../../services/workspace/workspace360Api';
import GestaoPeriodFilter from '../gestaoInsights/GestaoPeriodFilter';
import Workspace360AgentTicketsModal from './Workspace360AgentTicketsModal';
import '../gestaoInsights/gestaoInsights.css';

const TOP_N = 5;

function trendClass(trend) {
  return trend === 'down' ? 'ws360-leaderboard__trend--down' : 'ws360-leaderboard__trend--up';
}

export default function Workspace360OperationalLeaderboard({ onOpenTicket }) {
  const [shift, setShift] = useState('all');
  const [channel, setChannel] = useState('all');
  const [period, setPeriod] = useState({ period: 'mes' });
  const [entries, setEntries] = useState({ ranking: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drillAgent, setDrillAgent] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchWorkspace360Leaderboard({ period: period.period, from: period.from, to: period.to })
      .then((result) => {
        if (active) setEntries(result);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar o leaderboard operacional.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period.period, period.from, period.to]);

  const ranking = entries?.ranking || [];
  const showShiftFilter = ranking.some((row) => row?.shift != null && String(row.shift).trim() !== '');
  const showChannelFilter = ranking.some((row) => row?.channel != null && String(row.channel).trim() !== '');

  const allRows = useMemo(
    () => filterOperationalLeaderboard(ranking, { shift, channel }),
    [ranking, shift, channel],
  );
  const rows = expanded ? allRows : allRows.slice(0, TOP_N);
  const hiddenCount = Math.max(0, allRows.length - TOP_N);

  return (
    <section className="ws-panel ws360-leaderboard ws360-leaderboard--compact">
      <header className="ws360-leaderboard__head">
        <h4 className="ws360-leaderboard__title">
          <span className="ws360-leaderboard__title-icon" aria-hidden="true">
            <i className="ti ti-trophy" />
          </span>
          Leaderboard operacional
          <span className="ws360-leaderboard__title-tag">
            {expanded ? `Todos (${allRows.length})` : 'Top 5'}
          </span>
        </h4>
        <div className="ws360-leaderboard__filters">
          {showShiftFilter ? (
            <select
              className="ws360-leaderboard__select"
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              aria-label="Filtrar por turno"
            >
              {LEADERBOARD_SHIFT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : null}
          {showChannelFilter ? (
            <select
              className="ws360-leaderboard__select"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label="Filtrar por canal"
            >
              {LEADERBOARD_CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : null}
          <GestaoPeriodFilter value={period} onChange={setPeriod} idPrefix="gestao-leaderboard" />
        </div>
      </header>

      {error ? <p className="gestao-insight-card__error">{error}</p> : null}

      {loading ? (
        <p className="gestao-insight-card__loading">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="ws360-leaderboard__empty">Sem dados</p>
      ) : (
        <ol className="ws360-leaderboard__list">
          {rows.map((entry, index) => (
            <li
              key={entry.id}
              className={
                'ws360-leaderboard__item' +
                (entry.rank === 1 ? ' ws360-leaderboard__item--first' : '') +
                (index === rows.length - 1 ? ' ws360-leaderboard__item--last' : '')
              }
            >
              <span className="ws360-leaderboard__rank" aria-hidden="true">
                {entry.rank}
              </span>
              <div className="ws360-leaderboard__body">
                <div className="ws360-leaderboard__name-row">
                  {entry.medal ? (
                    <span className="ws360-leaderboard__medal" aria-label="1º lugar">
                      <i className="ti ti-medal" />
                    </span>
                  ) : null}
                  <span className={'ws360-leaderboard__trend ' + trendClass(entry.trend)} aria-hidden="true">
                    <i className={'ti ti-arrow-' + (entry.trend === 'down' ? 'down' : 'up')} />
                  </span>
                  <strong className="ws360-leaderboard__name">{entry.name}</strong>
                </div>
                <div className="ws360-leaderboard__metrics-row">
                  <button
                    type="button"
                    className="ws360-leaderboard__metric ws360-leaderboard__metric--clickable"
                    onClick={() => setDrillAgent({ agentKey: entry.agentKey, name: entry.name })}
                  >
                    <strong>{entry.inProgress}</strong>
                    <span>Em andamento</span>
                  </button>
                  <div className="ws360-leaderboard__metric">
                    <strong>{entry.resolved}</strong>
                    <span>Resolvidos</span>
                  </div>
                  <div className="ws360-leaderboard__metric">
                    <strong>{entry.tme}</strong>
                    <span>1ª resposta</span>
                  </div>
                  <div className="ws360-leaderboard__metric">
                    <strong>{entry.tma}</strong>
                    <span>Resolução</span>
                  </div>
                  <div className="ws360-leaderboard__metric">
                    <strong>{entry.csat == null ? '—' : entry.csat}</strong>
                    <span>Pesquisa</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!loading && (hiddenCount > 0 || expanded) ? (
        <button
          type="button"
          className="ws360-leaderboard__toggle"
          onClick={() => setExpanded((value) => !value)}
        >
          <i className={`ti ti-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
          {expanded ? 'Mostrar apenas Top 5' : `Ver todos os colaboradores (+${hiddenCount})`}
        </button>
      ) : null}

      <Workspace360AgentTicketsModal
        agent={drillAgent}
        onClose={() => setDrillAgent(null)}
        onOpenTicket={onOpenTicket}
      />
    </section>
  );
}
