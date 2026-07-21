/**
 * Preferências locais do agente no Desk CRM
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */

const AUTO_CLOSE_ON_SAVE_KEY = 'velodeskDeskAutoCloseOnSave';

export function getAutoCloseOnSave() {
  return localStorage.getItem(AUTO_CLOSE_ON_SAVE_KEY) === '1';
}

export function setAutoCloseOnSave(enabled) {
  localStorage.setItem(AUTO_CLOSE_ON_SAVE_KEY, enabled ? '1' : '0');
}
