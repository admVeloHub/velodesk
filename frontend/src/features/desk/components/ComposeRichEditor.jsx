/**
 * ComposeRichEditor v1.0.2 — notifica estado ativo da formatação
 * VERSION: v1.0.2 | DATE: 2026-07-02
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  execComposeFormat,
  getPlainOffset,
  htmlToPlainText,
  insertPlainTextInEditor,
  readComposeFormatState,
  readEditorHtml,
  replacePlainTextInEditor,
  setEditorHtml,
} from '../../../services/desk/composeRichEditor';

const ComposeRichEditor = forwardRef(function ComposeRichEditor({
  id,
  className = '',
  placeholder,
  value,
  onChange,
  onKeyDown,
  onBlur,
  onSelect,
  onClick,
  onFormatStateChange,
  hasSpellErrors = false,
}, ref) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef('');

  const notifyFormatState = useCallback(() => {
    onFormatStateChange?.(readComposeFormatState(editorRef.current));
  }, [onFormatStateChange]);

  const emitChange = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const html = readEditorHtml(root);
    if (html === lastHtmlRef.current) return;
    lastHtmlRef.current = html;
    onChange?.({
      html,
      plainText: htmlToPlainText(html),
      cursor: getPlainOffset(root),
    });
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    execFormat: (action) => {
      execComposeFormat(editorRef.current, action);
      emitChange();
      requestAnimationFrame(() => notifyFormatState());
    },
    replacePlainRange: (startIndex, deleteCount, insertText) => {
      const ok = replacePlainTextInEditor(editorRef.current, startIndex, deleteCount, insertText);
      if (ok) emitChange();
      return ok;
    },
    insertPlainText: (text) => {
      insertPlainTextInEditor(editorRef.current, text);
      emitChange();
    },
    getPlainText: () => htmlToPlainText(readEditorHtml(editorRef.current)),
    getHtml: () => readEditorHtml(editorRef.current),
    getCursor: () => getPlainOffset(editorRef.current),
    getFormatState: () => readComposeFormatState(editorRef.current),
  }), [emitChange, notifyFormatState]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const normalized = value || '';
    if (normalized === lastHtmlRef.current) return;
    if (document.activeElement === root) {
      const plainCurrent = htmlToPlainText(readEditorHtml(root));
      const plainNext = htmlToPlainText(normalized);
      if (plainCurrent === plainNext) {
        lastHtmlRef.current = normalized;
        return;
      }
    }
    setEditorHtml(root, normalized);
    lastHtmlRef.current = readEditorHtml(root);
  }, [value]);

  const wrapClass = 'compose-rich-editor-wrap spell-textarea-wrap'
    + (hasSpellErrors ? ' spell-textarea-wrap--has-errors' : '');

  return (
    <div className={wrapClass}>
      <div
        ref={editorRef}
        id={id}
        className={'compose-rich-editor response-textarea spell-textarea-input ' + className}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || ''}
        data-ai-skip="true"
        spellCheck
        lang="pt-BR"
        onInput={() => {
          emitChange();
          notifyFormatState();
        }}
        onKeyUp={notifyFormatState}
        onMouseUp={notifyFormatState}
        onFocus={notifyFormatState}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          emitChange();
          onFormatStateChange?.({
            bold: false,
            italic: false,
            underline: false,
            bulletList: false,
            numberedList: false,
          });
          onBlur?.({
            ...event,
            target: {
              ...event.target,
              selectionStart: getPlainOffset(editorRef.current),
              value: htmlToPlainText(readEditorHtml(editorRef.current)),
            },
          });
        }}
        onSelect={(event) => {
          notifyFormatState();
          onSelect?.({
            ...event,
            target: {
              ...event.target,
              selectionStart: getPlainOffset(editorRef.current),
            },
          });
        }}
        onClick={(event) => {
          notifyFormatState();
          onClick?.({
            ...event,
            target: {
              ...event.target,
              selectionStart: getPlainOffset(editorRef.current),
            },
          });
        }}
      />
    </div>
  );
});

export default ComposeRichEditor;
