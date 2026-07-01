/**
 * SpellSuggestionBar v1.0.1 — barra de sugestão ortográfica estilo digitação mobile
 * VERSION: v1.0.1 | DATE: 2026-06-26
 */
import React from 'react';

export default function SpellSuggestionBar({
  suggestion,
  loading,
  loadError,
  onApply,
  onDismiss,
  onIgnore,
}) {
  if (loadError) {
    const isDegraded = /envio liberado/i.test(loadError);
    return (
      <div
        className={'spell-suggestion-bar' + (isDegraded ? ' spell-suggestion-bar--warning' : ' spell-suggestion-bar--error')}
        role="status"
      >
        <i className={'ti ' + (isDegraded ? 'ti-info-circle' : 'ti-alert-circle')} aria-hidden="true" />
        <span>{loadError}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="spell-suggestion-bar spell-suggestion-bar--loading" role="status">
        <i className="ti ti-loader spell-suggestion-bar__spin" aria-hidden="true" />
        <span>Carregando corretor ortográfico…</span>
      </div>
    );
  }

  if (!suggestion) return null;

  const top = suggestion.suggestions?.[0];

  return (
    <div className="spell-suggestion-bar" role="status" aria-live="polite">
      <span className="spell-suggestion-bar__label">Sugestão:</span>
      <span className="spell-suggestion-bar__word spell-suggestion-bar__word--error">
        {suggestion.word}
      </span>
      {top ? (
        <>
          <span className="spell-suggestion-bar__arrow" aria-hidden="true">→</span>
          <button
            type="button"
            className="spell-suggestion-bar__suggestion"
            onClick={() => onApply(top)}
          >
            {top}
          </button>
          <span className="spell-suggestion-bar__hint">Tab para aplicar</span>
        </>
      ) : (
        <span className="spell-suggestion-bar__hint">Palavra não reconhecida — corrija antes de enviar</span>
      )}
      <button type="button" className="spell-suggestion-bar__action" onClick={onIgnore}>
        Ignorar
      </button>
      <button
        type="button"
        className="spell-suggestion-bar__close"
        onClick={onDismiss}
        aria-label="Fechar sugestão"
      >
        ×
      </button>
    </div>
  );
}

export function SpellErrorsPanel({ errors, onApplyFix }) {
  if (!errors?.length) return null;

  return (
    <div className="spell-errors-panel" role="alert">
      <div className="spell-errors-panel__header">
        <i className="ti ti-alert-circle" aria-hidden="true" />
        <span>
          Corrija {errors.length} erro{errors.length > 1 ? 's' : ''} ortográfico
          {errors.length > 1 ? 's' : ''} antes de enviar ao cliente.
        </span>
      </div>
      <ul className="spell-errors-panel__list">
        {errors.map((error) => (
          <li key={`${error.startIndex}-${error.word}`} className="spell-errors-panel__item">
            <span className="spell-errors-panel__word">{error.word}</span>
            {error.suggestions?.[0] ? (
              <>
                <span className="spell-errors-panel__arrow">→</span>
                <span className="spell-errors-panel__fix">{error.suggestions[0]}</span>
                <button
                  type="button"
                  className="spell-errors-panel__apply"
                  onClick={() => onApplyFix(error, error.suggestions[0])}
                >
                  Aplicar
                </button>
              </>
            ) : (
              <span className="spell-errors-panel__no-fix">sem sugestão</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
