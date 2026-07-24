/**
 * Hook — preferência de fechar aba ao salvar ticket
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */
import { useCallback, useEffect, useState } from 'react';
import {
  DESK_SAVE_BEHAVIOR_EVENT,
  readAutoCloseTabOnSave,
  writeAutoCloseTabOnSave,
} from '../services/desk/deskAgentPreferences';

export function useDeskSaveBehavior() {
  const [autoCloseOnSave, setAutoCloseOnSaveState] = useState(readAutoCloseTabOnSave);

  useEffect(() => {
    const onChange = (event) => {
      setAutoCloseOnSaveState(Boolean(event.detail?.autoCloseOnSave));
    };
    window.addEventListener(DESK_SAVE_BEHAVIOR_EVENT, onChange);
    return () => window.removeEventListener(DESK_SAVE_BEHAVIOR_EVENT, onChange);
  }, []);

  const setAutoCloseOnSave = useCallback((enabled) => {
    writeAutoCloseTabOnSave(enabled);
    setAutoCloseOnSaveState(Boolean(enabled));
  }, []);

  const toggleAutoCloseOnSave = useCallback(() => {
    setAutoCloseOnSave(!readAutoCloseTabOnSave());
  }, [setAutoCloseOnSave]);

  return { autoCloseOnSave, setAutoCloseOnSave, toggleAutoCloseOnSave };
}
