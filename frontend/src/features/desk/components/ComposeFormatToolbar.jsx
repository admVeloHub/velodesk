/**
 * ComposeFormatToolbar v1.0.1 — suporte embedded na barra inferior
 * VERSION: v1.0.1 | DATE: 2026-07-02
 */
import React, { useCallback } from 'react';
import { applyFormatAction, resolveFormatShortcut } from '../../../services/desk/composeTextFormat';

const TOOLBAR_ACTIONS = [
  { id: 'bold', label: 'Negrito', icon: 'ti ti-bold', shortcut: 'Ctrl+B' },
  { id: 'italic', label: 'Itálico', icon: 'ti ti-italic', shortcut: 'Ctrl+I' },
  { id: 'underline', label: 'Sublinhado', icon: 'ti ti-underline', shortcut: 'Ctrl+U' },
  { id: 'bulletList', label: 'Lista com marcadores', icon: 'ti ti-list', shortcut: null },
  { id: 'numberedList', label: 'Lista numerada', icon: 'ti ti-list-numbers', shortcut: null },
];

function restoreSelection(textarea, selectionStart, selectionEnd) {
  if (!textarea) return;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

export function useComposeFormat({ textareaRef, value, onValueChange }) {
  const applyAction = useCallback((action) => {
    const textarea = textareaRef?.current;
    if (!textarea) return;
    const result = applyFormatAction(
      value ?? '',
      textarea.selectionStart,
      textarea.selectionEnd,
      action,
    );
    onValueChange(result.value);
    restoreSelection(textarea, result.selectionStart, result.selectionEnd);
  }, [textareaRef, value, onValueChange]);

  const handleKeyDown = useCallback((event) => {
    const action = resolveFormatShortcut(event);
    if (!action) return false;
    event.preventDefault();
    applyAction(action);
    return true;
  }, [applyAction]);

  return { applyAction, handleKeyDown };
}

export default function ComposeFormatToolbar({ applyAction, variant = 'public', embedded = false }) {
  return (
    <div
      className={
        'crm-compose-toolbar response-toolbar'
        + (variant === 'internal' ? ' crm-compose-toolbar--internal' : '')
        + (embedded ? ' crm-compose-toolbar--embedded' : '')
      }
      role="toolbar"
      aria-label="Formatação de texto"
    >
      {TOOLBAR_ACTIONS.map((action, index) => (
        <React.Fragment key={action.id}>
          {index === 3 ? <span className="crm-compose-toolbar__sep" aria-hidden="true" /> : null}
          <button
            type="button"
            className="toolbar-btn crm-compose-toolbar__btn"
            title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
            aria-label={action.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(action.id)}
          >
            <i className={action.icon} aria-hidden="true" />
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
