/**
 * useComposeSpellCheck v1.2.0 — sugestões frescas + palavras flagadas persistentes
 * VERSION: v1.2.0 | DATE: 2026-06-26
 */
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
} from '../services/spellcheck/tokenize';

const WORD_BREAK_KEYS = new Set([' ', ',', '.', ';', ':', '!', '?', 'Enter']);
const SUGGESTION_DISMISS_WORDS = 2;

/**
 * @param {object} params
 * @param {string} params.text
 * @param {(value: string) => void} params.onTextChange
 * @param {object|null|undefined} params.tabulationConfig
 * @param {Set<string>} params.ignoredWords
 * @param {(word: string) => void} [params.onIgnoreWord]
 * @param {(errors: object[]) => void} [params.onFlaggedErrorsChange]
 * @param {boolean} [params.trackFlaggedErrors]
 */
export function useComposeSpellCheck({
  text,
  onTextChange,
  tabulationConfig,
  ignoredWords,
  onIgnoreWord,
  onFlaggedErrorsChange,
  trackFlaggedErrors = true,
}) {
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [flaggedErrors, setFlaggedErrors] = useState([]);
  const [activeErrorStartIndex, setActiveErrorStartIndex] = useState(null);
  const [spellLoading, setSpellLoading] = useState(() => !isSpellEngineReady());
  const [spellLoadError, setSpellLoadError] = useState(null);
  const wordsAfterSuggestionRef = useRef(0);
  const onFlaggedErrorsChangeRef = useRef(onFlaggedErrorsChange);
  onFlaggedErrorsChangeRef.current = onFlaggedErrorsChange;

  const spellContext = useMemo(
    () => createSpellContext(tabulationConfig, ignoredWords),
    [tabulationConfig, ignoredWords],
  );
  const spellContextRef = useRef(spellContext);
  spellContextRef.current = spellContext;

  useEffect(() => {
    let active = true;
    setSpellLoading(true);
    loadSpellEngine()
      .then(() => {
        if (active) {
          setSpellLoading(false);
          setSpellLoadError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setSpellLoading(false);
          setSpellLoadError(err?.message || 'Falha ao carregar corretor ortográfico.');
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeSuggestion) return;
    const currentWord = text.slice(activeSuggestion.startIndex, activeSuggestion.endIndex);
    if (currentWord !== activeSuggestion.word) {
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
      wordsAfterSuggestionRef.current = 0;
    }
  }, [text, activeSuggestion]);

  const publishFlaggedErrors = useCallback((errors) => {
    setFlaggedErrors(errors);
    if (trackFlaggedErrors) {
      onFlaggedErrorsChangeRef.current?.(errors);
    }
  }, [trackFlaggedErrors]);

  useEffect(() => {
    if (!trackFlaggedErrors || spellLoading || spellLoadError) return undefined;
    const timer = setTimeout(async () => {
      if (!String(text || '').trim()) {
        publishFlaggedErrors([]);
        return;
      }
      try {
        const errors = await scanText(
          text,
          spellContextRef.current.whitelist,
          spellContextRef.current.ignoredWords,
        );
        publishFlaggedErrors(errors);
      } catch {
        /* scan indisponível */
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [text, spellLoading, spellLoadError, trackFlaggedErrors, publishFlaggedErrors, ignoredWords, tabulationConfig]);

  const showSuggestionForError = useCallback((error) => {
    if (!error) return;
    wordsAfterSuggestionRef.current = 0;
    setActiveSuggestion(error);
    setActiveErrorStartIndex(error.startIndex);
  }, []);

  const evaluateWord = useCallback(async (wordInfo) => {
    if (!wordInfo?.word || spellLoading || spellLoadError) return;
    try {
      const result = await checkWord(
        wordInfo.word,
        spellContextRef.current.whitelist,
        spellContextRef.current.ignoredWords,
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
      setSpellLoadError('Falha ao verificar ortografia.');
    }
  }, [spellLoading, spellLoadError, showSuggestionForError]);

  const updateSuggestionFromCursor = useCallback((cursorPos) => {
    const wordInfo = getWordAtCursor(text, cursorPos);
    if (!wordInfo?.word) {
      setActiveSuggestion(null);
      setActiveErrorStartIndex(null);
      return;
    }
    evaluateWord(wordInfo);
  }, [text, evaluateWord]);

  const handleChange = useCallback((event) => {
    onTextChange(event.target.value);
  }, [onTextChange]);

  const handleKeyDown = useCallback((event) => {
    if (activeSuggestion && event.key === 'Tab' && activeSuggestion.suggestions?.length) {
      event.preventDefault();
      const replacement = activeSuggestion.suggestions[0];
      const nextText = replaceWordAt(
        text,
        activeSuggestion.startIndex,
        activeSuggestion.word,
        replacement,
      );
      onTextChange(nextText);
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
  }, [activeSuggestion, text, onTextChange, evaluateWord, updateSuggestionFromCursor]);

  const handleSelect = useCallback((event) => {
    updateSuggestionFromCursor(event.target.selectionStart ?? 0);
  }, [updateSuggestionFromCursor]);

  const handleClick = useCallback((event) => {
    updateSuggestionFromCursor(event.target.selectionStart ?? 0);
  }, [updateSuggestionFromCursor]);

  const handleBlur = useCallback((event) => {
    const cursor = event.target.selectionStart ?? text.length;
    const wordInfo = getLastWordBeforeCursor(text, cursor);
    if (wordInfo) evaluateWord(wordInfo);
  }, [text, evaluateWord]);

  const applySuggestion = useCallback((replacement) => {
    if (!activeSuggestion) return;
    const next = replacement || activeSuggestion.suggestions?.[0];
    if (!next) return;
    const nextText = replaceWordAt(
      text,
      activeSuggestion.startIndex,
      activeSuggestion.word,
      next,
    );
    onTextChange(nextText);
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
    wordsAfterSuggestionRef.current = 0;
  }, [activeSuggestion, text, onTextChange]);

  const dismissSuggestion = useCallback(() => {
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
  }, []);

  const ignoreSuggestion = useCallback(() => {
    if (!activeSuggestion?.word) return;
    onIgnoreWord?.(activeSuggestion.word.toLowerCase());
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
  }, [activeSuggestion, onIgnoreWord]);

  const applyErrorFix = useCallback(async (error, replacement) => {
    const liveWord = text.slice(error.startIndex, error.endIndex);
    if (liveWord !== error.word) return;
    let next = replacement;
    if (!next) {
      const fresh = await checkWord(
        liveWord,
        spellContextRef.current.whitelist,
        spellContextRef.current.ignoredWords,
      );
      next = fresh.suggestions?.[0];
    }
    if (!next) return;
    const nextText = replaceWordAt(text, error.startIndex, error.word, next);
    onTextChange(nextText);
    setActiveSuggestion(null);
    setActiveErrorStartIndex(null);
  }, [text, onTextChange]);

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
    applyErrorFix,
    spellContext,
  };
}
