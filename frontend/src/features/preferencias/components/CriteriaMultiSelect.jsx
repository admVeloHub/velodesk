/**
 * Multi-select com chips para critérios de caixa personalizada
 * VERSION: v1.0.1 | DATE: 2026-07-31
 */
import React, { useEffect, useId, useRef, useState } from 'react';

export default function CriteriaMultiSelect({
  options = [],
  values = [],
  onChange,
  placeholder = 'Selecione…',
  ariaLabel = 'Valores do critério',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = new Set(values);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (value) => {
    const next = selected.has(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
    onChange?.(next);
  };

  return (
    <div className="queue-box-multi" ref={rootRef}>
      <button
        type="button"
        className={'queue-box-multi__trigger' + (open ? ' is-open' : '')}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
      >
        <div className="queue-box-multi__values" aria-live="polite">
          {values.length ? (
            <div className="queue-box-multi__chips">
              {values.map((value) => {
                const opt = options.find((item) => item.value === value);
                return (
                  <span key={value} className="queue-box-multi__chip">
                    {opt?.label || value}
                    <button
                      type="button"
                      className="queue-box-multi__chip-remove"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(value);
                      }}
                      aria-label={`Remover ${opt?.label || value}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="queue-box-multi__placeholder">{placeholder}</span>
          )}
        </div>
        <i className="ti ti-chevron-down queue-box-multi__chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="queue-box-multi__panel" id={listId} role="listbox" aria-multiselectable="true">
          {options.length ? options.map((opt) => (
            <label key={opt.value} className="queue-box-multi__option">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          )) : (
            <p className="queue-box-multi__empty">Nenhuma opção disponível</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
