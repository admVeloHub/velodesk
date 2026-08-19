/**
 * gestaoInsightsPainel.service v1.1.0 — cache TTL curto do payload unificado
 * VERSION: v1.1.0 | DATE: 2026-08-19
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

type PainelPayload = Awaited<ReturnType<typeof computeGestaoInsightsPainel>>;

const PAINEL_PAYLOAD_TTL_MS = 45_000;
const painelPayloadCache = new Map<string, { at: number; promise: Promise<PainelPayload> }>();

function painelCacheKey(query: GestaoInsightsPainelQuery): string {
  return JSON.stringify({
    period: query.period ?? 'mes',
    from: query.from ?? null,
    to: query.to ?? null,
    granularity: query.granularity ?? 'dia',
  });
}

async function computeGestaoInsightsPainel(query: GestaoInsightsPainelQuery = {}) {
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

export async function getGestaoInsightsPainel(query: GestaoInsightsPainelQuery = {}) {
  const key = painelCacheKey(query);
  const now = Date.now();
  const cached = painelPayloadCache.get(key);
  if (cached && now - cached.at < PAINEL_PAYLOAD_TTL_MS) {
    return cached.promise;
  }
  const promise = computeGestaoInsightsPainel(query);
  painelPayloadCache.set(key, { at: now, promise });
  try {
    return await promise;
  } catch (err) {
    painelPayloadCache.delete(key);
    throw err;
  }
}
