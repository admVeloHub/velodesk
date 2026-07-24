/**
 * FuncoesDeskAccordion v1.0.1 — lista retrátil de funções Desk
 * VERSION: v1.0.1 | DATE: 2026-07-22
 */
import React from 'react';

export default function FuncoesDeskAccordion({ open, onToggle, funcoes, onSelectFuncao }) {
  const list = funcoes || [];

  return (
    <div className="fp-accordion">
      <button
        type="button"
        className={'fp-accordion__header' + (open ? ' is-open' : '')}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="fp-accordion__title">
          Funções Desk
          {list.length > 0 ? (
            <span className="fp-accordion__count">{list.length}</span>
          ) : null}
        </span>
        <i className={'ti ti-chevron-' + (open ? 'up' : 'down')} aria-hidden="true" />
      </button>
      {open ? (
        list.length === 0 ? (
          <div className="fp-accordion__panel fp-agentes-empty">
            <p>Nenhuma função Desk configurada ainda.</p>
          </div>
        ) : (
          <ul className="fp-accordion__panel fp-funcoes-list">
            {list.map((f) => (
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
        )
      ) : null}
    </div>
  );
}
