/**
 * velohubApiConfig v1.3.3 — proxy /velohub-api → API VeloHub (VeloHubCentral)
 * VERSION: v1.3.3 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 *
 * VeloNews: somente via esta API. Mongo no VeloHubCentral:
 *   - console_conteudo.Velonews
 *   - console_conteudo.velonews_acknowledgments
 */

export const VELOHUB_API_PROXY_PREFIX = '/velohub-api';

/** Referência de persistência VeloNews — somente API VeloHub, nunca Mongo do VeloDesk */
export const VELONEWS_MONGO_REFERENCE = Object.freeze({
  cluster: 'VeloHubCentral',
  database: 'console_conteudo',
  collections: {
    content: 'Velonews',
    acknowledgments: 'velonews_acknowledgments',
  },
});

export function getVelohubApiBaseUrl() {
  return VELOHUB_API_PROXY_PREFIX;
}

export function requireVelohubApiBaseUrl() {
  return VELOHUB_API_PROXY_PREFIX;
}
