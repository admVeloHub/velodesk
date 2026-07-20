/**
 * FuncoesDeskAccordion v1.0.0 — lista retrátil de funções Desk
 */
import React from 'react';

export default function FuncoesDeskAccordion({ open, onToggle, funcoes, onSelectFuncao }) {
  return (
    <div className="fp-accordion">
      <button
        type="button"
        className={'fp-accordion__header' + (open ? ' is-open' : '')}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="fp-accordion__title">Funções Desk</span>
        <i className={'ti ti-chevron-' + (open ? 'up' : 'down')} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="fp-accordion__panel fp-funcoes-list">
          {(funcoes || []).map((f) => (
            <li key={f.slug}>
              <button
                type="button"
                className="fp-funcao-item"
                onClick={() => onSelectFuncao(f.slug)}
              >
                <span className="fp-funcao-item__nome">{f.nome || f.slug}</span>
                <span className="fp-badge">Nível {f.nivel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
