/**
 * Cockpit config
 * VERSION: v2.2.0 | DATE: 2026-07-07 | AUTHOR: VeloHub Development Team
 */
export function initCockpitGlobals() {
  if (typeof window === 'undefined') return;
  window.VELODESK_COCKPIT = true;
}
