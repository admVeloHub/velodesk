/**
 * macrosCache v1.0.0 — cache em memória das macros ativas para o menu do compose
 * VERSION: v1.0.0 | DATE: 2026-09-03
 */
import { macrosApi } from '../../api/client';

let cache = null;
let inflight = null;

/** Chame após criar/editar/excluir uma macro na Central de Configurações. */
export function invalidateMacrosCache() {
  cache = null;
  inflight = null;
}

function sortMacros(list) {
  return [...(list || [])].sort((a, b) => {
    const ordemDiff = (a.ordem ?? 0) - (b.ordem ?? 0);
    if (ordemDiff !== 0) return ordemDiff;
    return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  });
}

export async function fetchActiveMacrosCached() {
  if (cache) return cache;
  if (!inflight) {
    inflight = macrosApi.list(false)
      .then((data) => {
        cache = sortMacros(Array.isArray(data) ? data.filter((m) => m.ativo !== false) : []);
        return cache;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}
