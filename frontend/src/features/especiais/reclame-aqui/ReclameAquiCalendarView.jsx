/**
 * ReclameAquiCalendarView — grade mensal por prazo RA
 */
import React, { useMemo } from 'react';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function buildCalendarGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

export default function ReclameAquiCalendarView({
  items,
  year,
  month,
  onPrevMonth,
  onNextMonth,
}) {
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);
  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const eventsByDay = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const d = new Date(item.prazoRa);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const day = d.getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(item);
    });
    return map;
  }, [items, year, month]);

  return (
    <div className="ra-calendar">
      <header className="ra-calendar__head">
        <button type="button" className="ra-calendar__nav" onClick={onPrevMonth} aria-label="Mês anterior">
          <i className="ti ti-chevron-left" />
        </button>
        <h3 className="ra-calendar__title">{monthLabel}</h3>
        <button type="button" className="ra-calendar__nav" onClick={onNextMonth} aria-label="Próximo mês">
          <i className="ti ti-chevron-right" />
        </button>
      </header>

      <div className="ra-calendar__weekdays">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="ra-calendar__weekday">{wd}</span>
        ))}
      </div>

      <div className="ra-calendar__grid">
        {grid.map((day, idx) => {
          const dayEvents = day ? eventsByDay.get(day) || [] : [];
          const isToday = day && (() => {
            const t = new Date();
            return t.getDate() === day && t.getMonth() === month && t.getFullYear() === year;
          })();
          return (
            <div
              key={idx}
              className={'ra-calendar__cell' + (day ? '' : ' ra-calendar__cell--empty') + (isToday ? ' is-today' : '')}
            >
              {day ? <span className="ra-calendar__day">{day}</span> : null}
              {dayEvents.slice(0, 2).map((ev) => (
                <span key={ev.id} className="ra-calendar__event" title={ev.assunto}>
                  {ev.consumidor.split(' ')[0]}
                </span>
              ))}
              {dayEvents.length > 2 ? (
                <span className="ra-calendar__more">+{dayEvents.length - 2}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
