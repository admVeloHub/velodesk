/**
 * aiUsage.service v1.0.0 — registro e relatório de custo/tokens de IA (OpenAI/Gemini)
 * VERSION: v1.0.0 | DATE: 2026-07-21
 */
import { AiUsageLog, AiUsageFeature, AiUsageProvider } from '../models/AiUsageLog';
import { estimateCostUsd } from '../config/aiPricing';
import {
  dayKey,
  dayKeysBetween,
  labelForDay,
  resolvePeriodRange,
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

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function getAiUsageDailyReport(query: GestaoInsightsQuery = {}) {
  const range = resolvePeriodRange(query);
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

  const series = dayKeys.map((key) => {
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

  const daysInRange = Math.max(1, dayKeys.length);
  const avgDailyCostUsd = totalCostUsd / daysInRange;

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
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
  };
}
