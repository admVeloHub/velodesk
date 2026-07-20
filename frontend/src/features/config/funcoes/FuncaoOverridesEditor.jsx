/**
 * FuncaoOverridesEditor v1.0.0 — editor reutilizável de permissões por módulo
 */
import React, { useState } from 'react';
import {
  MODULO_LABELS,
  SUB_LABELS,
  countActivePerms,
  sortCatalogEntries,
} from './funcaoPermissoesLabels';

export default function FuncaoOverridesEditor({ catalog, draft, setDraft, className = '' }) {
  const [moduloOpen, setModuloOpen] = useState('portal');

  if (!draft) return null;

  const catalogEntries = sortCatalogEntries(catalog);

  const togglePerm = (modulo, key) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, permissoes: { ...prev.permissoes } };
      if (!next.permissoes[modulo]) next.permissoes[modulo] = {};
      next.permissoes[modulo] = { ...next.permissoes[modulo] };
      next.permissoes[modulo][key] = !next.permissoes[modulo][key];
      return next;
    });
  };

  const toggleModulo = (modulo) => {
    setModuloOpen((prev) => (prev === modulo ? null : modulo));
  };

  return (
    <div className={'fp-overrides-editor' + (className ? ` ${className}` : '')}>
      <div className="fp-modal__meta">
        <label className="fp-field">
          <span>Nível</span>
          <input
            type="number"
            min="1"
            value={draft.nivel}
            onChange={(e) => setDraft((d) => ({ ...d, nivel: Number(e.target.value) }))}
          />
        </label>
        <label className="fp-field">
          <span>Herda de (slugs, vírgula)</span>
          <input
            type="text"
            value={(draft.herdaDe || []).join(', ')}
            onChange={(e) => setDraft((d) => ({
              ...d,
              herdaDe: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            }))}
          />
        </label>
      </div>

      <div className="fp-modulos">
        {catalogEntries.map(([modulo, keys]) => {
          const isOpen = moduloOpen === modulo;
          const activeCount = countActivePerms(draft, modulo, keys);
          const headerId = `fp-modulo-${modulo}-header`;
          const panelId = `fp-modulo-${modulo}-panel`;

          return (
            <div key={modulo} className={'fp-accordion fp-accordion--nested' + (isOpen ? ' is-open' : '')}>
              <button
                type="button"
                id={headerId}
                className={'fp-accordion__header' + (isOpen ? ' is-open' : '')}
                onClick={() => toggleModulo(modulo)}
                aria-expanded={isOpen}
                aria-controls={panelId}
              >
                <span className="fp-accordion__title">
                  {MODULO_LABELS[modulo] || modulo}
                  {activeCount > 0 ? (
                    <span className="fp-accordion__count">{activeCount} ativa{activeCount !== 1 ? 's' : ''}</span>
                  ) : null}
                </span>
                <i className={'ti ti-chevron-' + (isOpen ? 'up' : 'down')} aria-hidden="true" />
              </button>
              {isOpen ? (
                <div id={panelId} className="fp-accordion__panel fp-modulo-panel" role="region" aria-labelledby={headerId}>
                  <div className="fp-permissoes-matrix">
                    {(keys || []).map((key) => (
                      <label key={key} className="fp-permissao-check">
                        <input
                          type="checkbox"
                          checked={draft.permissoes?.[modulo]?.[key] === true}
                          onChange={() => togglePerm(modulo, key)}
                        />
                        <span>{SUB_LABELS[key] || key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
