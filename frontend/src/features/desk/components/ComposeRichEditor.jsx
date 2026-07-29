/**
 * ComposeRichEditor v1.1.0 — suporte a readOnly (ticket fechado)
 * VERSION: v1.1.0 | DATE: 2026-07-29
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  execComposeFormat,
  getPlainOffset,
  htmlToPlainText,
  insertPlainTextInEditor,
  insertImageInEditor,
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
  expandable = false,
  readOnly = false,
}, ref) {
  const editorRef = useRef(null);
  const lastHtmlRef = useRef('');
  const [expanded, setExpanded] = useState(false);

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
    insertImage: (src, alt) => {
      const ok = insertImageInEditor(editorRef.current, src, alt);
      if (ok) emitChange();
      return ok;
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

  useEffect(() => {
    setExpanded(false);
  }, [id]);

  const wrapClass = 'compose-rich-editor-wrap spell-textarea-wrap'
    + (hasSpellErrors ? ' spell-textarea-wrap--has-errors' : '')
    + (expandable ? ' compose-rich-editor-wrap--expandable' : '')
    + (expanded ? ' compose-rich-editor-wrap--expanded' : '');

  return (
    <div className={wrapClass}>
      <div
        ref={editorRef}
        id={id}
        className={'compose-rich-editor response-textarea spell-textarea-input '
          + className
          + (expanded ? ' compose-rich-editor--expanded' : '')}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-readonly={readOnly || undefined}
        data-placeholder={placeholder || ''}
        data-ai-skip="true"
        spellCheck={!readOnly}
        lang="pt-BR"
        onInput={() => {
          if (readOnly) return;
          emitChange();
          notifyFormatState();
        }}
        onKeyUp={readOnly ? undefined : notifyFormatState}
        onMouseUp={readOnly ? undefined : notifyFormatState}
        onFocus={readOnly ? undefined : notifyFormatState}
        onKeyDown={readOnly ? undefined : onKeyDown}
        onBlur={readOnly ? undefined : ((event) => {
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
        })}
        onSelect={readOnly ? undefined : ((event) => {
          notifyFormatState();
          onSelect?.({
            ...event,
            target: {
              ...event.target,
              selectionStart: getPlainOffset(editorRef.current),
            },
          });
        })}
        onClick={readOnly ? undefined : ((event) => {
          notifyFormatState();
          onClick?.({
            ...event,
            target: {
              ...event.target,
              selectionStart: getPlainOffset(editorRef.current),
            },
          });
        })}
      />
      {expandable ? (
        <button
          type="button"
          className="compose-rich-editor__expand-btn"
          aria-label={expanded ? 'Recolher editor' : 'Expandir editor'}
          aria-pressed={expanded}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setExpanded((value) => !value)}
        >
          <i className={'ti ' + (expanded ? 'ti-arrows-minimize' : 'ti-arrows-maximize')} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});

export default ComposeRichEditor;
