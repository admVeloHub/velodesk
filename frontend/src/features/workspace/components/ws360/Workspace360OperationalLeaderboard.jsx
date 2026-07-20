/**
 * Leaderboard operacional — painel supervisor
 * VERSION: v3.0.0 | DATE: 2026-07-20
 */
import React, { useMemo, useState } from 'react';
import {
  filterOperationalLeaderboard,
  LEADERBOARD_CHANNEL_OPTIONS,
  LEADERBOARD_SHIFT_OPTIONS,
} from '../../../../services/workspace/deskData';

function trendClass(trend) {
  return trend === 'down' ? 'ws360-leaderboard__trend--down' : 'ws360-leaderboard__trend--up';
}

function deltaClass(value) {
  if (!value || value === '—') return '';
  if (value.startsWith('-')) return 'ws360-leaderboard__delta--down';
  if (value.startsWith('+')) return 'ws360-leaderboard__delta--up';
  return '';
}

function LeaderboardColumn({ icon, title, rows }) {
  return (
    <div className="ws360-leaderboard__column">
      <h5 className="ws360-leaderboard__column-title">
        <i className={`ti ${icon}`} aria-hidden="true" />
        {title}
      </h5>
      {rows.length === 0 ? (
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
                <p className="ws360-leaderboard__metrics">
                  {entry.sla} SLA · {entry.primaryValue} {entry.primaryLabel} · TMA {entry.tma} · Pesquisa média{' '}
                  {entry.csat == null ? '—' : entry.csat}
                  <br />
                  <span className={'ws360-leaderboard__delta ' + deltaClass(entry.vsLastWeek)}>
                    vs semana anterior: {entry.vsLastWeek || '—'}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function Workspace360OperationalLeaderboard({ entries }) {
  const [shift, setShift] = useState('all');
  const [channel, setChannel] = useState('all');

  const resolvedRows = useMemo(
    () => filterOperationalLeaderboard(entries?.resolvedRanking, { shift, channel }),
    [entries, shift, channel],
  );
  const interactionRows = useMemo(
    () => filterOperationalLeaderboard(entries?.interactionRanking, { shift, channel }),
    [entries, shift, channel],
  );

  return (
    <section className="ws-panel ws360-leaderboard">
      <header className="ws360-leaderboard__head">
        <h4 className="ws360-leaderboard__title">
          <span className="ws360-leaderboard__title-icon" aria-hidden="true">
            <i className="ti ti-trophy" />
          </span>
          Leaderboard operacional
        </h4>
        <div className="ws360-leaderboard__filters">
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
        </div>
      </header>

      <div className="ws360-leaderboard__columns">
        <LeaderboardColumn icon="ti-circle-check" title="Mais resolveram" rows={resolvedRows} />
        <LeaderboardColumn icon="ti-messages" title="Mais interagiram" rows={interactionRows} />
      </div>
    </section>
  );
}
