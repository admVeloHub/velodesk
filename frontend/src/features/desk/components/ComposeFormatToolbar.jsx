/**
 * ComposeFormatToolbar v1.1.0 — botão anexar imagem à direita
 * VERSION: v1.1.0 | DATE: 2026-07-22
 */
import React, { useCallback, useRef, useState } from 'react';
import { applyFormatAction, resolveFormatShortcut } from '../../../services/desk/composeTextFormat';

const EMPTY_FORMAT_STATE = {
  bold: false,
  italic: false,
  underline: false,
  bulletList: false,
  numberedList: false,
};

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

export function useComposeFormat({
  textareaRef,
  richEditorRef,
  mode = 'rich',
  value,
  onValueChange,
}) {
  const [activeFormats, setActiveFormats] = useState(EMPTY_FORMAT_STATE);

  const handleFormatStateChange = useCallback((nextState) => {
    setActiveFormats({ ...EMPTY_FORMAT_STATE, ...nextState });
  }, []);

  const refreshFormatState = useCallback(() => {
    if (mode !== 'rich') return;
    const state = richEditorRef?.current?.getFormatState?.();
    if (state) setActiveFormats({ ...EMPTY_FORMAT_STATE, ...state });
  }, [mode, richEditorRef]);

  const applyAction = useCallback((action) => {
    if (mode === 'rich') {
      richEditorRef?.current?.execFormat(action);
      requestAnimationFrame(() => refreshFormatState());
      return;
    }
    const textarea = textareaRef?.current;
    if (!textarea) return;
    const result = applyFormatAction(
      value ?? '',
      textarea.selectionStart,
      textarea.selectionEnd,
      action,
    );
    onValueChange?.(result.value);
    restoreSelection(textarea, result.selectionStart, result.selectionEnd);
  }, [mode, richEditorRef, textareaRef, value, onValueChange, refreshFormatState]);

  const handleKeyDown = useCallback((event) => {
    const action = resolveFormatShortcut(event);
    if (!action) return false;
    event.preventDefault();
    applyAction(action);
    return true;
  }, [applyAction]);

  return {
    applyAction,
    handleKeyDown,
    activeFormats,
    handleFormatStateChange,
    refreshFormatState,
  };
}

export default function ComposeFormatToolbar({
  applyAction,
  activeFormats = EMPTY_FORMAT_STATE,
  variant = 'public',
  embedded = false,
  onImageSelected,
  attachDisabled = false,
}) {
  const fileInputRef = useRef(null);

  const handleAttachClick = useCallback(() => {
    if (attachDisabled) return;
    fileInputRef.current?.click();
  }, [attachDisabled]);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImageSelected) return;
    onImageSelected(file);
  }, [onImageSelected]);

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
            className={
              'toolbar-btn crm-compose-toolbar__btn'
              + (activeFormats[action.id] ? ' crm-compose-toolbar__btn--active' : '')
            }
            title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
            aria-label={action.label}
            aria-pressed={Boolean(activeFormats[action.id])}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyAction(action.id)}
          >
            <i className={action.icon} aria-hidden="true" />
          </button>
        </React.Fragment>
      ))}
      {onImageSelected ? (
        <>
          <button
            type="button"
            className="toolbar-btn crm-compose-toolbar__btn crm-compose-toolbar__attach"
            title="Anexar imagem"
            aria-label="Anexar imagem"
            disabled={attachDisabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAttachClick}
          >
            <i className="ti ti-photo" aria-hidden="true" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="crm-compose-toolbar__file-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
          />
        </>
      ) : null}
    </div>
  );
}
