/**
 * velohubApiConfig v1.3.0 — proxy same-origin /velohub-api (dev + Cloud Run)
 * VERSION: v1.3.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export const VELOHUB_API_PROXY_PREFIX = '/velohub-api';

export function getVelohubApiBaseUrl() {
  return VELOHUB_API_PROXY_PREFIX;
}

export function requireVelohubApiBaseUrl() {
  return VELOHUB_API_PROXY_PREFIX;
}
