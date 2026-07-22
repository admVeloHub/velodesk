/**
 * aiUsage.service v1.1.0 — registro e relatório de custo/tokens de IA (OpenAI/Gemini)
 * VERSION: v1.1.0 | DATE: 2026-07-22
 */
import mongoose from 'mongoose';
import { AiUsageLog, AiUsageFeature, AiUsageProvider } from '../models/AiUsageLog';
import { User } from '../models/User';
import { ChamadoN1 } from '../models/ChamadoN1';
import { estimateCostUsd } from '../config/aiPricing';
import {
  ComparisonMode,
  DateRange,
  dayKey,
  dayKeysBetween,
  getCurrentMonthRange,
  getCurrentYearRange,
  labelForDay,
  labelForMonth,
  monthKey,
  resolveComparisonRange,
  resolveSeriesRange,
  GestaoInsightsQuery,
} from './gestaoInsights.service';

export interface LogAiUsageParams {
  provider: AiUsageProvider;
  model: string;
  feature: AiUsageFeature;
  inputTokens?: number;
  outputTokens?: number;
  ticketId?: string;
  protocolo?: string;
  userId?: string;
}

/** Fire-and-forget: nunca deve lançar erro para não interromper o fluxo do agente/atendimento que a chamou. */
export async function logAiUsage(params: LogAiUsageParams): Promise<void> {
  try {
    const inputTokens = Math.max(0, Math.round(params.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.round(params.outputTokens ?? 0));
    const { costUsd, source } = estimateCostUsd(params.model, inputTokens, outputTokens);

    await AiUsageLog.create({
      provider: params.provider,
      modelName: params.model,
      feature: params.feature,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: costUsd,
      pricingSource: source,
      ticketId: params.ticketId,
      protocolo: params.protocolo,
      userId: params.userId,
    });
  } catch (err) {
    console.error('[ai-usage] falha ao registrar uso de IA:', err);
  }
}

interface DailyBucket {
  key: string;
  label: string;
  openaiCostUsd: number;
  geminiCostUsd: number;
  totalCostUsd: number;
  totalTokens: number;
}

interface FeatureBreakdown {
  feature: string;
  tokens: number;
  costUsd: number;
  calls: number;
}

interface ModelBreakdown {
  provider: string;
  model: string;
  tokens: number;
  costUsd: number;
  calls: number;
  fallbackPricing: boolean;
}

interface ColaboradorBreakdown {
  key: string;
  label: string;
  tokens: number;
  costUsd: number;
  calls: number;
}

interface ProdutoBreakdown {
  produto: string;
  tokens: number;
  costUsd: number;
  calls: number;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

interface SeriesPoint {
  key: string;
  label: string;
  openaiCostUsd: number;
  geminiCostUsd: number;
  totalCostUsd: number;
  totalTokens: number;
}

/** Agrega a série diária de custo de IA em buckets de mês fechado (soma de custos/tokens). */
function aggregateAiUsageSeriesByMonth(daily: SeriesPoint[]): SeriesPoint[] {
  const buckets = new Map<string, { openai: number; gemini: number; total: number; tokens: number }>();
  const order: string[] = [];
  daily.forEach((day) => {
    const key = monthKey(new Date(`${day.key}T12:00:00`));
    if (!buckets.has(key)) {
      buckets.set(key, { openai: 0, gemini: 0, total: 0, tokens: 0 });
      order.push(key);
    }
    const bucket = buckets.get(key)!;
    bucket.openai += day.openaiCostUsd;
    bucket.gemini += day.geminiCostUsd;
    bucket.total += day.totalCostUsd;
    bucket.tokens += day.totalTokens;
  });
  return order.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      key,
      label: labelForMonth(key),
      openaiCostUsd: round4(bucket.openai),
      geminiCostUsd: round4(bucket.gemini),
      totalCostUsd: round4(bucket.total),
      totalTokens: bucket.tokens,
    };
  });
}

/** Agrega a série diária do comparativo (MoM/YoY) em buckets de mês fechado. */
function aggregateComparisonSeriesByMonth(
  daily: { key: string; label: string; totalCostUsd: number }[],
): { key: string; label: string; totalCostUsd: number }[] {
  const buckets = new Map<string, number>();
  const order: string[] = [];
  daily.forEach((day) => {
    const key = monthKey(new Date(`${day.key}T12:00:00`));
    if (!buckets.has(key)) {
      buckets.set(key, 0);
      order.push(key);
    }
    buckets.set(key, buckets.get(key)! + day.totalCostUsd);
  });
  return order.map((key) => ({ key, label: labelForMonth(key), totalCostUsd: round4(buckets.get(key)!) }));
}

function isObjectId(value?: string | null): value is string {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));
}

/** Soma bruta (agregação no banco) do custo de IA num intervalo — usada nos totais compactos do card principal. */
async function sumCostForRange(range: DateRange): Promise<number> {
  const rows = await AiUsageLog.aggregate<{ _id: null; total: number }>([
    { $match: { createdAt: { $gte: range.start, $lte: range.end } } },
    { $group: { _id: null, total: { $sum: '$estimatedCostUsd' } } },
  ]);
  return round4(rows[0]?.total ?? 0);
}

export interface AiUsageTotals {
  currentMonth: number;
  currentYear: number;
}

/** Totais de custo do mês e do ano corrente — usados no tile compacto do painel principal de Gestão. */
export async function getAiUsageTotals(): Promise<AiUsageTotals> {
  const [currentMonth, currentYear] = await Promise.all([
    sumCostForRange(getCurrentMonthRange()),
    sumCostForRange(getCurrentYearRange()),
  ]);
  return { currentMonth, currentYear };
}

export async function getAiUsageDailyReport(
  query: GestaoInsightsQuery & { compare?: string; granularity?: string } = {},
) {
  const { range, granularity } = resolveSeriesRange(query);
  const compareMode: ComparisonMode | undefined =
    query.compare === 'mom' || query.compare === 'yoy' ? query.compare : undefined;

  const logs = await AiUsageLog.find({
    createdAt: { $gte: range.start, $lte: range.end },
  })
    .sort({ createdAt: 1 })
    .lean();

  const dayKeys = dayKeysBetween(range);
  const buckets = new Map<string, DailyBucket>(
    dayKeys.map((key) => [
      key,
      { key, label: labelForDay(key), openaiCostUsd: 0, geminiCostUsd: 0, totalCostUsd: 0, totalTokens: 0 },
    ]),
  );

  const byFeature = new Map<string, FeatureBreakdown>();
  const byModel = new Map<string, ModelBreakdown>();

  let totalCostUsd = 0;
  let totalTokens = 0;
  let totalCalls = 0;
  let openaiCostUsd = 0;
  let geminiCostUsd = 0;

  for (const log of logs) {
    const createdAt = new Date(log.createdAt as unknown as string);
    const key = dayKey(createdAt);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.totalCostUsd += log.estimatedCostUsd;
      bucket.totalTokens += log.totalTokens;
      if (log.provider === 'openai') bucket.openaiCostUsd += log.estimatedCostUsd;
      if (log.provider === 'gemini') bucket.geminiCostUsd += log.estimatedCostUsd;
    }

    totalCostUsd += log.estimatedCostUsd;
    totalTokens += log.totalTokens;
    totalCalls += 1;
    if (log.provider === 'openai') openaiCostUsd += log.estimatedCostUsd;
    if (log.provider === 'gemini') geminiCostUsd += log.estimatedCostUsd;

    const featureEntry = byFeature.get(log.feature) ?? { feature: log.feature, tokens: 0, costUsd: 0, calls: 0 };
    featureEntry.tokens += log.totalTokens;
    featureEntry.costUsd += log.estimatedCostUsd;
    featureEntry.calls += 1;
    byFeature.set(log.feature, featureEntry);

    const modelKey = `${log.provider}:${log.modelName}`;
    const modelEntry =
      byModel.get(modelKey) ??
      { provider: log.provider, model: log.modelName, tokens: 0, costUsd: 0, calls: 0, fallbackPricing: false };
    modelEntry.tokens += log.totalTokens;
    modelEntry.costUsd += log.estimatedCostUsd;
    modelEntry.calls += 1;
    if (log.pricingSource === 'fallback') modelEntry.fallbackPricing = true;
    byModel.set(modelKey, modelEntry);
  }

  // ── Por colaborador ──
  const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => Boolean(id)))];
  const resolvableIds = userIds.filter(isObjectId);
  const users = resolvableIds.length
    ? await User.find({ _id: { $in: resolvableIds } }).select('name email').lean()
    : [];
  const userNameById = new Map(users.map((u) => [String(u._id), u.name || u.email || String(u._id)]));

  const byColaboradorMap = new Map<string, ColaboradorBreakdown>();
  for (const log of logs) {
    let key: string;
    let label: string;
    if (log.userId && userNameById.has(log.userId)) {
      key = log.userId;
      label = userNameById.get(log.userId)!;
    } else if (!log.userId && log.feature === 'gestao_chamados') {
      key = 'automatico';
      label = 'Automático';
    } else if (!log.userId) {
      key = 'nao_identificado';
      label = 'Não identificado';
    } else {
      key = log.userId;
      label = log.userId;
    }
    const entry = byColaboradorMap.get(key) ?? { key, label, tokens: 0, costUsd: 0, calls: 0 };
    entry.tokens += log.totalTokens;
    entry.costUsd += log.estimatedCostUsd;
    entry.calls += 1;
    byColaboradorMap.set(key, entry);
  }

  // ── Por produto (via tabulação do ticket vinculado, quando existir) ──
  const ticketIds = [...new Set(logs.map((l) => l.ticketId).filter((id): id is string => Boolean(id)))];
  const resolvableTicketIds = ticketIds.filter(isObjectId);
  const tickets = resolvableTicketIds.length
    ? await ChamadoN1.find({ _id: { $in: resolvableTicketIds } }).select('tabulacao').lean()
    : [];
  const produtoByTicketId = new Map<string, string>();
  tickets.forEach((t) => {
    const tab = t.tabulacao?.[t.tabulacao.length - 1];
    const produto = String(tab?.produto ?? '').trim();
    if (produto) produtoByTicketId.set(String((t as unknown as { _id: unknown })._id), produto);
  });

  const byProdutoMap = new Map<string, ProdutoBreakdown>();
  for (const log of logs) {
    const produto = (log.ticketId && produtoByTicketId.get(log.ticketId)) || 'Sem produto identificado';
    const entry = byProdutoMap.get(produto) ?? { produto, tokens: 0, costUsd: 0, calls: 0 };
    entry.tokens += log.totalTokens;
    entry.costUsd += log.estimatedCostUsd;
    entry.calls += 1;
    byProdutoMap.set(produto, entry);
  }

  const dailySeries = dayKeys.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      key: bucket.key,
      label: bucket.label,
      openaiCostUsd: round4(bucket.openaiCostUsd),
      geminiCostUsd: round4(bucket.geminiCostUsd),
      totalCostUsd: round4(bucket.totalCostUsd),
      totalTokens: bucket.totalTokens,
    };
  });

  const series = granularity === 'mes' ? aggregateAiUsageSeriesByMonth(dailySeries) : dailySeries;

  const daysInRange = Math.max(1, dayKeys.length);
  const avgDailyCostUsd = totalCostUsd / daysInRange;

  // ── Comparativo MoM/YoY (opcional) ──
  let comparison:
    | {
        mode: ComparisonMode;
        range: { start: string; end: string };
        totalCostUsd: number;
        deltaPct: number | null;
        series: { key: string; label: string; totalCostUsd: number }[];
      }
    | undefined;

  if (compareMode) {
    const comparisonRange = resolveComparisonRange(range, compareMode);
    const comparisonLogs = await AiUsageLog.find({
      createdAt: { $gte: comparisonRange.start, $lte: comparisonRange.end },
    })
      .select('estimatedCostUsd createdAt')
      .lean();

    const comparisonDayKeys = dayKeysBetween(comparisonRange);
    const comparisonBuckets = new Map<string, number>(comparisonDayKeys.map((k) => [k, 0]));
    let comparisonTotalCost = 0;
    comparisonLogs.forEach((log) => {
      const key = dayKey(new Date(log.createdAt as unknown as string));
      comparisonTotalCost += log.estimatedCostUsd;
      if (comparisonBuckets.has(key)) {
        comparisonBuckets.set(key, (comparisonBuckets.get(key) ?? 0) + log.estimatedCostUsd);
      }
    });

    const comparisonSeriesDaily = dayKeys.map((key, idx) => {
      const prevKey = comparisonDayKeys[idx];
      return {
        key,
        label: labelForDay(key),
        totalCostUsd: round4(prevKey ? comparisonBuckets.get(prevKey) ?? 0 : 0),
      };
    });

    comparison = {
      mode: compareMode,
      range: { start: comparisonRange.start.toISOString(), end: comparisonRange.end.toISOString() },
      totalCostUsd: round4(comparisonTotalCost),
      deltaPct:
        comparisonTotalCost > 0
          ? Math.round(((totalCostUsd - comparisonTotalCost) / comparisonTotalCost) * 1000) / 10
          : null,
      series: granularity === 'mes' ? aggregateComparisonSeriesByMonth(comparisonSeriesDaily) : comparisonSeriesDaily,
    };
  }

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    granularity,
    summary: {
      totalCostUsd: round4(totalCostUsd),
      totalTokens,
      totalCalls,
      openaiCostUsd: round4(openaiCostUsd),
      geminiCostUsd: round4(geminiCostUsd),
      avgDailyCostUsd: round4(avgDailyCostUsd),
      projectedMonthlyCostUsd: round4(avgDailyCostUsd * 30),
    },
    series,
    byFeature: Array.from(byFeature.values())
      .map((entry) => ({ ...entry, costUsd: round4(entry.costUsd) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byModel: Array.from(byModel.values())
      .map((entry) => ({ ...entry, costUsd: round4(entry.costUsd) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byColaborador: Array.from(byColaboradorMap.values())
      .map((entry) => ({ ...entry, costUsd: round4(entry.costUsd) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byProduto: Array.from(byProdutoMap.values())
      .map((entry) => ({ ...entry, costUsd: round4(entry.costUsd) }))
      .sort((a, b) => b.costUsd - a.costUsd),
    comparison,
  };
}
