/**
 * SpellComposeTextarea v1.1.0 — preview visual de formatação no mirror
 * VERSION: v1.1.0 | DATE: 2026-07-02
 */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  buildFormattedMirrorHtml,
  composeTextHasFormatting,
} from '../../../services/desk/composeFormatPreview';

const SPELL_INPUT_PROPS = {
  spellCheck: true,
  lang: 'pt-BR',
  autoCorrect: 'on',
  autoCapitalize: 'sentences',
};

/** @param {string} text @param {Array<{ startIndex: number, endIndex: number }>} errors @param {number|null} activeStartIndex */
function buildHighlightParts(text, errors, activeStartIndex) {
  if (!text) return [];
  const sorted = [...errors].sort((a, b) => a.startIndex - b.startIndex);
  const parts = [];
  let cursor = 0;

  for (const error of sorted) {
    if (error.startIndex < cursor) continue;
    if (error.startIndex > text.length) continue;
    if (error.startIndex > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, error.startIndex) });
    }
    const end = Math.min(error.endIndex, text.length);
    parts.push({
      type: 'error',
      value: text.slice(error.startIndex, end),
      active: error.startIndex === activeStartIndex,
    });
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }

  return parts;
}

export default function SpellComposeTextarea({
  id,
  className,
  placeholder,
  rows,
  value,
  flaggedErrors,
  activeErrorStartIndex,
  onChange,
  onKeyDown,
  onBlur,
  onSelect,
  onClick,
  textareaRef,
  visualFormat = true,
}) {
  const localRef = useRef(null);
  const mirrorRef = useRef(null);
  const ref = textareaRef || localRef;

  const showVisualFormat = visualFormat && composeTextHasFormatting(value);

  const mirrorHtml = useMemo(
    () => buildFormattedMirrorHtml(value, flaggedErrors || [], activeErrorStartIndex ?? null),
    [value, flaggedErrors, activeErrorStartIndex],
  );

  const parts = useMemo(
    () => buildHighlightParts(value, flaggedErrors || [], activeErrorStartIndex ?? null),
    [value, flaggedErrors, activeErrorStartIndex],
  );

  const syncScroll = useCallback(() => {
    const textarea = ref.current;
    const mirror = mirrorRef.current;
    if (textarea && mirror) {
      mirror.scrollTop = textarea.scrollTop;
      mirror.scrollLeft = textarea.scrollLeft;
    }
  }, [ref]);

  const wrapClass = 'spell-textarea-wrap'
    + (flaggedErrors?.length ? ' spell-textarea-wrap--has-errors' : '')
    + (showVisualFormat ? ' spell-textarea-wrap--formatted' : '');

  return (
    <div className={wrapClass}>
      <div
        ref={mirrorRef}
        className={'spell-textarea-mirror ' + className}
        aria-hidden="true"
      >
        {showVisualFormat ? (
          <div
            className="spell-textarea-mirror__formatted"
            dangerouslySetInnerHTML={{ __html: mirrorHtml }}
          />
        ) : (
          parts.length ? parts.map((part, index) => {
            if (part.type === 'error') {
              return (
                <mark
                  key={'err-' + index}
                  className={'spell-textarea-mark' + (part.active ? ' spell-textarea-mark--active' : '')}
                >
                  {part.value}
                </mark>
              );
            }
            return <span key={'txt-' + index}>{part.value}</span>;
          }) : (value || '\u00A0')
        )}
      </div>
      <textarea
        {...SPELL_INPUT_PROPS}
        ref={ref}
        className={'spell-textarea-input ' + className}
        id={id}
        data-ai-skip="true"
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onSelect={onSelect}
        onClick={onClick}
        onScroll={syncScroll}
      />
    </div>
  );
}
