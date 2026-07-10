/**
 * useComposeSpellCheck v2.1.0 — suporte a desativação via flag
 * VERSION: v2.1.0 | DATE: 2026-07-10
 */
import { COMPOSE_SPELLCHECK_ENABLED } from '../services/desk/constants';
import { addSpellWhitelistTerms } from '../services/spellcheck/whitelist';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  checkWord,
  createSpellContext,
  isSpellEngineReady,
  loadSpellEngine,
  scanText,
} from '../services/spellcheck/spellEngine';
import {
  getLastWordBeforeCursor,
  getWordAtCursor,
  replaceWordAt,
  tokenizeText,
} from '../services/spellcheck/tokenize';

const WORD_BREAK_KEYS = new Set([' ', ',', '.', ';', ':', '!', '?', 'Enter']);
const SUGGESTION_DISMISS_WORDS = 2;

const noop = () => {};

/** @param {string} fullText @param {{ startIndex: number, endIndex?: number }} wordInfo */
function buildTokenContext(fullText, wordInfo) {
  const tokens = tokenizeText(fullText);
  const tokenIndex = tokens.findIndex((token) => token.startIndex === wordInfo.startIndex);
  return {
    text: fullText,
    tokens,
    tokenIndex,
    startIndex: wordInfo.startIndex,
    endIndex: wordInfo.endIndex,
  };
}

/**
 * @param {object} params
 * @param {string} params.text
 * @param {(value: string) => void} params.onTextChange
 * @param {object|null|undefined} params.tabulationConfig
 * @param {Set<string>} params.ignoredWords
 * @param {Iterable<string>} [params.extraWhitelistTerms]
 * @param {(word: string) => void} [params.onIgnoreWord]
 * @param {(errors: object[]) => void} [params.onFlaggedErrorsChange]
 * @param {boolean} [params.trackFlaggedErrors]
 * @param {boolean} [params.enabled]
 */
export function useComposeSpellCheck({
  text,
  onTextChange,
  onReplaceRange,
  tabulationConfig,
  ignoredWords,
  extraWhitelistTerms,
  onIgnoreWord,
  onFlaggedErrorsChange,
  trackFlaggedErrors = true,
  enabled = COMPOSE_SPELLCHECK_ENABLED,
}) {
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [flaggedErrors, setFlaggedErrors] = useState([]);
  const [activeErrorStartIndex, setActiveErrorStartIndex] = useState(null);
  const [spellLoading, setSpellLoading] = useState(() => (
    enabled ? !isSpellEngineReady() : false
  ));
  const [spellLoadError, setSpellLoadError] = useState(null);
  const wordsAfterSuggestionRef = useRef(0);
  const onFlaggedErrorsChangeRef = useRef(onFlaggedErrorsChange);
  const scanAbortRef = useRef(null);
  onFlaggedErrorsChangeRef.current = onFlaggedErrorsChange;

  const spellContext = useMemo(() => {
    const ctx = createSpellContext(tabulationConfig, ignoredWords);
    for (const term of extraWhitelistTerms || []) {
      addSpellWhitelistTerms(ctx.whitelist, term);
    }
    return ctx;
  }, [tabulationConfig, ignoredWords, extraWhitelistTerms]);
  const spellContextRef = useRef(spellContext);
  spellContextRef.current = spellContext;

  useEffect(() => {
    if (!enabled) {
      setActiveSuggestion(null);
      setFlaggedErrors([]);
      setActiveErrorStartIndex(null);
      setSpellLoading(false);
      setSpellLoadError(null);
      if (trackFlaggedErrors) {
        onFlaggedErrorsChangeRef.current?.([]);
      }
      return undefined;
    }

    let active = true;
    setSpellLoading(true);
    loadSpellEngine()
      .then((ready) => {
        if (active) {
          setSpellLoading(false);
          setSpellLoadError(ready ? null : 'Corretor indisponível — envio liberado.');
        }
      })
      .catch(() => {
        if (active) {
          setSpellLoading(false);
          setSpellLoadError('Corretor indisponível — envio liberado.');
        }
      });
    return () => { active = false; };
  }, [enabled, trackFlaggedErrors]);

  useEffect(() => {
    if (!enabled || !activeSuggestion) return;
    const currentWord = text.slice(activeSuggestion.startIndex, activeSuggestion.endIndex);
    if (currentWord !== activeSuggestion.word) {
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
      wordsAfterSuggestionRef.current = 0;
    }
  }, [enabled, text, activeSuggestion]);

  const publishFlaggedErrors = useCallback((errors) => {
    setFlaggedErrors(errors);
    if (trackFlaggedErrors) {
      onFlaggedErrorsChangeRef.current?.(errors);
    }
  }, [trackFlaggedErrors]);

  useEffect(() => {
    if (!enabled || !trackFlaggedErrors || spellLoading) return undefined;
    const timer = setTimeout(async () => {
      if (scanAbortRef.current) {
        scanAbortRef.current.abort();
      }
      const controller = new AbortController();
      scanAbortRef.current = controller;

      if (!String(text || '').trim()) {
        publishFlaggedErrors([]);
        setSpellLoadError(null);
        return;
      }
      try {
        const errors = await scanText(
          text,
          spellContextRef.current.whitelist,
          spellContextRef.current.ignoredWords,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        publishFlaggedErrors(errors);
        setSpellLoadError(isSpellEngineReady() ? null : 'Corretor indisponível — envio liberado.');
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
          return;
        }
        publishFlaggedErrors([]);
        setSpellLoadError('Corretor indisponível — envio liberado.');
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      if (scanAbortRef.current) {
        scanAbortRef.current.abort();
      }
    };
  }, [enabled, text, spellLoading, trackFlaggedErrors, publishFlaggedErrors, ignoredWords, tabulationConfig, extraWhitelistTerms]);

  const registerIgnoredTerms = useCallback((word) => {
    const raw = String(word || '').trim();
    if (!raw) return;
    onIgnoreWord?.(raw);
  }, [onIgnoreWord]);

  const removeIgnoredFromErrors = useCallback((word) => {
    const raw = String(word || '').trim().toLowerCase();
    if (!raw) return;
    const skipTerms = new Set();
    addSpellWhitelistTerms(skipTerms, raw);
    setFlaggedErrors((prev) => {
      const next = prev.filter((error) => !skipTerms.has(String(error.word || '').toLowerCase()));
      if (trackFlaggedErrors) {
        onFlaggedErrorsChangeRef.current?.(next);
      }
      return next;
    });
    if (activeSuggestion?.word) {
      const activeLower = activeSuggestion.word.toLowerCase();
      if (skipTerms.has(activeLower)) {
        setActiveSuggestion(null);
        setActiveErrorStartIndex(null);
      }
    }
    wordsAfterSuggestionRef.current = 0;
  }, [activeSuggestion, trackFlaggedErrors]);

  const showSuggestionForError = useCallback((error) => {
    if (!error) return;
    wordsAfterSuggestionRef.current = 0;
    setActiveSuggestion(error);
    setActiveErrorStartIndex(error.startIndex);
  }, []);

  const evaluateWord = useCallback(async (wordInfo) => {
    if (!enabled || !wordInfo?.word || spellLoading) return;
    try {
      const result = await checkWord(
        wordInfo.word,
        spellContextRef.current.whitelist,
        spellContextRef.current.ignoredWords,
        buildTokenContext(text, wordInfo),
      );
      if (result.valid) {
        setActiveSuggestion(null);
        setActiveErrorStartIndex(null);
        return;
      }
      showSuggestionForError({
        ...wordInfo,
        endIndex: wordInfo.endIndex ?? wordInfo.startIndex + wordInfo.word.length,
        suggestions: result.suggestions,
      });
    } catch {
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
    }
  }, [enabled, text, spellLoading, showSuggestionForError]);

  const updateSuggestionFromCursor = useCallback((cursorPos) => {
    if (!enabled) return;
    const wordInfo = getWordAtCursor(text, cursorPos);
    if (!wordInfo?.word) {
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
      return;
    }
    evaluateWord(wordInfo);
  }, [enabled, text, evaluateWord]);

  const handleChange = useCallback((event) => {
    onTextChange(event.target.value);
  }, [onTextChange]);

  const applyTextReplacement = useCallback((startIndex, word, replacement) => {
    if (onReplaceRange) {
      onReplaceRange(startIndex, word.length, replacement);
      return;
    }
    onTextChange(replaceWordAt(text, startIndex, word, replacement));
  }, [onReplaceRange, onTextChange, text]);

  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;
    if (activeSuggestion && event.key === 'Tab' && activeSuggestion.suggestions?.length) {
      event.preventDefault();
      const replacement = activeSuggestion.suggestions[0];
      applyTextReplacement(activeSuggestion.startIndex, activeSuggestion.word, replacement);
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
      wordsAfterSuggestionRef.current = 0;
      return;
    }

    if (WORD_BREAK_KEYS.has(event.key)) {
      if (activeSuggestion) {
        wordsAfterSuggestionRef.current += 1;
        if (wordsAfterSuggestionRef.current >= SUGGESTION_DISMISS_WORDS) {
          setActiveSuggestion(null);
          setActiveErrorStartIndex(null);
        }
      }
      const cursor = event.target.selectionStart ?? text.length;
      const wordInfo = getLastWordBeforeCursor(text, cursor);
      if (wordInfo) evaluateWord(wordInfo);
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      requestAnimationFrame(() => {
        updateSuggestionFromCursor(event.target.selectionStart ?? 0);
      });
    }
  }, [enabled, activeSuggestion, text, applyTextReplacement, evaluateWord, updateSuggestionFromCursor]);

  const handleSelect = useCallback((event) => {
    if (!enabled) return;
    updateSuggestionFromCursor(event.target.selectionStart ?? 0);
  }, [enabled, updateSuggestionFromCursor]);

  const handleClick = useCallback((event) => {
    if (!enabled) return;
    updateSuggestionFromCursor(event.target.selectionStart ?? 0);
  }, [enabled, updateSuggestionFromCursor]);

  const handleBlur = useCallback((event) => {
    if (!enabled) return;
    const cursor = event.target.selectionStart ?? text.length;
    const wordInfo = getLastWordBeforeCursor(text, cursor);
    if (wordInfo) evaluateWord(wordInfo);
  }, [enabled, text, evaluateWord]);

  const applySuggestion = useCallback((replacement) => {
    if (!enabled || !activeSuggestion) return;
    const next = replacement || activeSuggestion.suggestions?.[0];
    if (!next) return;
    applyTextReplacement(activeSuggestion.startIndex, activeSuggestion.word, next);
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
    wordsAfterSuggestionRef.current = 0;
  }, [enabled, activeSuggestion, applyTextReplacement]);

  const dismissSuggestion = useCallback(() => {
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
  }, []);

  const ignoreSuggestion = useCallback(() => {
    if (!enabled || !activeSuggestion?.word) return;
    registerIgnoredTerms(activeSuggestion.word);
    removeIgnoredFromErrors(activeSuggestion.word);
  }, [enabled, activeSuggestion, registerIgnoredTerms, removeIgnoredFromErrors]);

  const ignoreWord = useCallback((word) => {
    if (!enabled) return;
    registerIgnoredTerms(word);
    removeIgnoredFromErrors(word);
  }, [enabled, registerIgnoredTerms, removeIgnoredFromErrors]);

  const applyErrorFix = useCallback(async (error, replacement) => {
    if (!enabled) return;
    const liveWord = text.slice(error.startIndex, error.endIndex);
    if (liveWord !== error.word) return;
    let next = replacement;
    if (!next) {
      const fresh = await checkWord(
        liveWord,
        spellContextRef.current.whitelist,
        spellContextRef.current.ignoredWords,
        buildTokenContext(text, error),
      );
      next = fresh.suggestions?.[0];
    }
    if (!next) return;
    applyTextReplacement(error.startIndex, error.word, next);
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
  }, [enabled, text, applyTextReplacement]);

  if (!enabled) {
    return {
      activeSuggestion: null,
      flaggedErrors: [],
      activeErrorStartIndex: null,
      spellLoading: false,
      spellLoadError: null,
      handleChange,
      handleKeyDown: noop,
      handleBlur: noop,
      handleSelect: noop,
      handleClick: noop,
      applySuggestion: noop,
      dismissSuggestion: noop,
      ignoreSuggestion: noop,
      ignoreWord: noop,
      applyErrorFix: noop,
      spellContext,
    };
  }

  return {
    activeSuggestion,
    flaggedErrors,
    activeErrorStartIndex,
    spellLoading,
    spellLoadError,
    handleChange,
    handleKeyDown,
    handleBlur,
    handleSelect,
    handleClick,
    applySuggestion,
    dismissSuggestion,
    ignoreSuggestion,
    ignoreWord,
    applyErrorFix,
    spellContext,
  };
}
