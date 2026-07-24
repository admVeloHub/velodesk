/**
 * Preferências locais do agente no Desk CRM
 * VERSION: v1.0.1 | DATE: 2026-07-24
 */

import { DESK_SEARCH_MODE_CPF, DESK_SEARCH_MODES } from './constants';

const AUTO_CLOSE_ON_SAVE_KEY = 'velodeskDeskAutoCloseOnSave';
const SEARCH_MODE_KEY = 'velodeskDeskSearchMode';

export function getAutoCloseOnSave() {
  return localStorage.getItem(AUTO_CLOSE_ON_SAVE_KEY) === '1';
}

export function setAutoCloseOnSave(enabled) {
  localStorage.setItem(AUTO_CLOSE_ON_SAVE_KEY, enabled ? '1' : '0');
}

export function getDeskSearchMode() {
  const stored = localStorage.getItem(SEARCH_MODE_KEY);
  return DESK_SEARCH_MODES.includes(stored) ? stored : DESK_SEARCH_MODE_CPF;
}

export function setDeskSearchMode(mode) {
  localStorage.setItem(SEARCH_MODE_KEY, DESK_SEARCH_MODES.includes(mode) ? mode : DESK_SEARCH_MODE_CPF);
}
