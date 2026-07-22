/**
 * GestaoGranularityToggle v1.0.0 — alterna a granularidade dos gráficos da Gestão entre
 * "Dia" (dia a dia, respeitando o período selecionado) e "Mês" (meses fechados do ano corrente).
 * DATE: 2026-07-22 | AUTHOR: VeloHub Development Team
 */
import React from 'react';

export const GESTAO_GRANULARITY_OPTIONS = [
  { value: 'dia', label: 'Dia' },
  { value: 'mes', label: 'Mês' },
];

/**
 * @param {object} props
 * @param {'dia'|'mes'} props.value
 * @param {(next: 'dia'|'mes') => void} props.onChange
 */
export default function GestaoGranularityToggle({ value, onChange }) {
  return (
    <div className="gestao-granularity-toggle" role="group" aria-label="Selecionar granularidade do gráfico">
      {GESTAO_GRANULARITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={
            'gestao-granularity-toggle__pill' +
            ((value || 'dia') === opt.value ? ' gestao-granularity-toggle__pill--active' : '')
          }
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
