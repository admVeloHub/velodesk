/**
 * workspace360Api v1.0.0 — Painel 360° via GET /api/workspace360
 * VERSION: v1.0.0 | DATE: 2026-07-06
 */
import api from '../../api/client';

export async function fetchWorkspace360(params) {
  const { data } = await api.get('/workspace360', { params });
  return data;
}

export async function fetchWorkspace360Report(reportId, filters = {}) {
  const { data } = await api.get('/workspace360', {
    params: { report: reportId, ...filters },
  });
  return data.report;
}

export async function fetchWorkspace360Agents() {
  const { data } = await api.get('/workspace360/agents');
  return data;
}
