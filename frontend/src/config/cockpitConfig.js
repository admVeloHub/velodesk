/**
 * Cockpit config
 * VERSION: v2.1.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
export function initCockpitGlobals() {
  if (typeof window === 'undefined') return;
  window.VELODESK_COCKPIT = true;
}

export function resetVelodeskLabData() {
  const keep = ['velodeskDarkMode', 'velodesk_token', 'velodesk_user', 'velodeskProfile'];
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && keep.indexOf(k) === -1) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}
