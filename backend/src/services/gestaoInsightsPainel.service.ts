/**
 * gestaoInsightsPainel.service v1.0.0 — payload unificado dos cards analíticos da Gestão
 * VERSION: v1.0.0 | DATE: 2026-08-18
 *
 * Um único GET /gestao-insights/painel dispara os cálculos em paralelo no backend e devolve
 * resumo, volume, motivos, casos especiais e risco IA — eliminando 5+ round-trips do frontend.
 * voz-cliente fica congelado (card em desenvolvimento).
 */
import {
  getCasosEspeciais,
  getTopMotivosPorProduto,
  getVolumeSeries,
  getVolumeSummary,
  GestaoInsightsQuery,
  resolvePeriodRange,
} from './gestaoInsights.service';
import { getRiscosCasoEspecial } from './chamadoIaAnalise.service';

export interface GestaoInsightsPainelQuery extends GestaoInsightsQuery {
  granularity?: string;
}

export async function getGestaoInsightsPainel(query: GestaoInsightsPainelQuery = {}) {
  const granularity = String(query.granularity ?? 'dia').trim() || 'dia';
  const range = resolvePeriodRange(query);

  const [resumo, volume, motivos, casosEspeciais, riscoItems] = await Promise.all([
    getVolumeSummary(query),
    getVolumeSeries({ ...query, granularity }),
    getTopMotivosPorProduto(query, 10),
    getCasosEspeciais(query),
    getRiscosCasoEspecial(10),
  ]);

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    resumo,
    volume,
    motivos,
    casosEspeciais,
    risco: { items: riscoItems },
  };
}
