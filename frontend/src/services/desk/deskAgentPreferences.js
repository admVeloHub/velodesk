/**
 * Preferências locais do agente no Desk v2
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */

export const DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY = 'velodeskDeskAutoCloseTabOnSave';
export const DESK_SAVE_BEHAVIOR_EVENT = 'velodesk:desk-save-behavior-changed';

export function readAutoCloseTabOnSave() {
  try {
    return localStorage.getItem(DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAutoCloseTabOnSave(enabled) {
  try {
    localStorage.setItem(DESK_AUTO_CLOSE_TAB_ON_SAVE_KEY, enabled ? '1' : '0');
  } catch {
    /* storage indisponível */
  }
  window.dispatchEvent(new CustomEvent(DESK_SAVE_BEHAVIOR_EVENT, {
    detail: { autoCloseOnSave: Boolean(enabled) },
  }));
}
