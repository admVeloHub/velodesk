/**
 * GestaoPeriodFilter v1.0.0 — seletor de período (Hoje/Ontem/Mês/Personalizado) para cards da Gestão
 * DATE: 2026-07-17 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';

export const GESTAO_PERIOD_OPTIONS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'mes', label: 'Mês' },
  { value: 'personalizado', label: 'Personalizado' },
];

export const GESTAO_COMPARE_OPTIONS = [
  { value: '', label: 'Sem comparativo' },
  { value: 'mom', label: 'Mês a mês' },
  { value: 'yoy', label: 'Ano a ano' },
];

/**
 * @param {object} props
 * @param {boolean} [props.showCompare] — exibe o seletor secundário de comparação (MoM/YoY), usado nas páginas de detalhe.
 * @param {string} [props.compareValue] — 'mom' | 'yoy' | '' (sem comparativo).
 * @param {(mode: string) => void} [props.onCompareChange]
 */
export default function GestaoPeriodFilter({
  value,
  onChange,
  idPrefix = 'gestao-period',
  showCompare = false,
  compareValue = '',
  onCompareChange,
}) {
  const { period, from, to } = value ?? {};
  const [draftFrom, setDraftFrom] = useState(from || '');
  const [draftTo, setDraftTo] = useState(to || '');

  const handlePick = (nextPeriod) => {
    if (nextPeriod === 'personalizado') {
      onChange({ period: nextPeriod, from: draftFrom || undefined, to: draftTo || undefined });
      return;
    }
    onChange({ period: nextPeriod, from: undefined, to: undefined });
  };

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo) return;
    onChange({ period: 'personalizado', from: draftFrom, to: draftTo });
  };

  return (
    <div className="gestao-period-filter">
      <div className="gestao-period-filter__pills" role="group" aria-label="Selecionar período">
        {GESTAO_PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={
              'gestao-period-filter__pill' +
              (period === opt.value ? ' gestao-period-filter__pill--active' : '')
            }
            onClick={() => handlePick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {period === 'personalizado' ? (
        <div className="gestao-period-filter__range">
          <label htmlFor={`${idPrefix}-from`} className="gestao-period-filter__sr-only">De</label>
          <input
            id={`${idPrefix}-from`}
            type="date"
            className="gestao-period-filter__date"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => setDraftFrom(e.target.value)}
          />
          <span className="gestao-period-filter__range-sep">até</span>
          <label htmlFor={`${idPrefix}-to`} className="gestao-period-filter__sr-only">Até</label>
          <input
            id={`${idPrefix}-to`}
            type="date"
            className="gestao-period-filter__date"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => setDraftTo(e.target.value)}
          />
          <button
            type="button"
            className="gestao-period-filter__apply"
            onClick={applyCustomRange}
            disabled={!draftFrom || !draftTo}
          >
            Aplicar
          </button>
        </div>
      ) : null}

      {showCompare ? (
        <div className="gestao-period-filter__compare" role="group" aria-label="Selecionar comparativo">
          {GESTAO_COMPARE_OPTIONS.map((opt) => (
            <button
              key={opt.value || 'none'}
              type="button"
              className={
                'gestao-period-filter__compare-pill' +
                ((compareValue || '') === opt.value ? ' gestao-period-filter__compare-pill--active' : '')
              }
              onClick={() => onCompareChange?.(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
