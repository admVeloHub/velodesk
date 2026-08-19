/**
 * Preferências locais do agente no Desk CRM
 * VERSION: v1.0.2 | DATE: 2026-08-18
 */

import { DESK_SEARCH_MODE_CPF, DESK_SEARCH_MODES } from './constants';
import { DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY, DESK_SAVE_BEHAVIOR_EVENT } from './deskAgentPreferences';

const AUTO_CLOSE_ON_SAVE_KEY = 'velodeskDeskAutoCloseOnSave';
const SEARCH_MODE_KEY = 'velodeskDeskSearchMode';

export function getAutoCloseOnSave() {
  try {
    const primary = localStorage.getItem(AUTO_CLOSE_ON_SAVE_KEY);
    if (primary !== null) return primary === '1';
    return localStorage.getItem(DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAutoCloseOnSave(enabled) {
  const value = enabled ? '1' : '0';
  localStorage.setItem(AUTO_CLOSE_ON_SAVE_KEY, value);
  try {
    localStorage.setItem(DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY, value);
    window.dispatchEvent(new CustomEvent(DESK_SAVE_BEHAVIOR_EVENT, {
      detail: { autoCloseOnSave: Boolean(enabled) },
    }));
  } catch {
    /* storage indisponível */
  }
}

export function getDeskSearchMode() {
  const stored = localStorage.getItem(SEARCH_MODE_KEY);
  return DESK_SEARCH_MODES.includes(stored) ? stored : DESK_SEARCH_MODE_CPF;
}

export function setDeskSearchMode(mode) {
  localStorage.setItem(SEARCH_MODE_KEY, DESK_SEARCH_MODES.includes(mode) ? mode : DESK_SEARCH_MODE_CPF);
}
