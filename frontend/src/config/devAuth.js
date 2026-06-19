/**
 * devAuth v1.0.0 — bypass de login em localhost (somente Vite dev)
 * VERSION: v1.0.0 | DATE: 2026-06-19 | AUTHOR: VeloHub Development Team
 */

export const DEV_LOCAL_TOKEN = 'dev-localhost-bypass';

export const DEV_LOCAL_USER = {
  id: 'dev-local',
  name: 'Admin Velodesk',
  email: 'admin@velodesk.local',
  role: 'supervisor',
};

export function isLocalDevBypass() {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function applyLocalDevSession() {
  localStorage.setItem('velodesk_token', DEV_LOCAL_TOKEN);
  localStorage.setItem('velodesk_user', JSON.stringify(DEV_LOCAL_USER));
  return { token: DEV_LOCAL_TOKEN, user: DEV_LOCAL_USER };
}
