/**
 * ticketIaSettings.service v1.0.0 — seed, configuração e conhecimento da IA
 * VERSION: v1.0.0 | DATE: 2026-07-28
 */
import fs from 'fs';
import path from 'path';
import { TicketIaExemplo } from '../models/TicketIaExemplo';
import {
  ITicketIaAlias,
  ITicketIaSettings,
  TicketIaSettings,
} from '../models/TicketIaSettings';

export interface TicketIaKnowledgeSeed {
  metadata?: {
    exportedAt?: string;
    sourceProject?: string;
    contextoVersao?: number;
    defaults?: {
      maxTicketsPorChamada?: number;
      maxExemplosPorMotivoNoPrompt?: number;
      maxExemplosTotalNoPrompt?: number;
    };
  };
  contextoEmpresa?: string;
  instrucoesOutros?: string;
  taxonomiaMotivos?: string[];
  motivoAliases?: ITicketIaAlias[];
  exemplosContexto?: Array<{ titulo?: string; trecho?: string; motivo?: string }>;
}

export interface TicketIaExamplePrompt {
  titulo: string;
  trecho: string;
  motivo: string;
}

const DEFAULT_KEY = 'default';

function cleanText(value: unknown, max = 20000): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function cleanInstructions(value: unknown): string {
  return cleanText(value)
    .split('\n')
    .filter((line) => line.trim() !== '-')
    .join('\n')
    .trim();
}

function normalizeTaxonomy(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, 200)).filter(Boolean))];
}

function normalizeAliases(values: unknown): ITicketIaAlias[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const result: ITicketIaAlias[] = [];
  for (const item of values) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const de = cleanText(row.de, 200);
    const para = cleanText(row.para, 200);
    const key = normalizeForComparison(de);
    if (!de || !para || seen.has(key)) continue;
    seen.add(key);
    result.push({ de, para });
  }
  return result;
}

function knowledgeCandidates(): string[] {
  return [
    path.resolve(process.cwd(), '../exports/ticket-ia-knowledge/knowledge.json'),
    path.resolve(process.cwd(), 'exports/ticket-ia-knowledge/knowledge.json'),
    path.resolve(process.cwd(), 'knowledge/knowledge.json'),
    path.resolve(__dirname, '../../../exports/ticket-ia-knowledge/knowledge.json'),
  ];
}

export function readExportedTicketIaKnowledge(): TicketIaKnowledgeSeed | null {
  for (const candidate of knowledgeCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      return JSON.parse(fs.readFileSync(candidate, 'utf8')) as TicketIaKnowledgeSeed;
    } catch (err) {
      console.warn('[ticket-ia-settings] não foi possível ler knowledge.json:', (err as Error).message);
    }
  }
  return null;
}

export async function ensureTicketIaSettings(): Promise<ITicketIaSettings> {
  const existing = await TicketIaSettings.findOne({ key: DEFAULT_KEY });
  if (existing) return existing;

  const knowledge = readExportedTicketIaKnowledge();
  const defaults = knowledge?.metadata?.defaults;
  const created = await TicketIaSettings.findOneAndUpdate(
    { key: DEFAULT_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_KEY,
        contextoEmpresa: cleanText(knowledge?.contextoEmpresa),
        instrucoesOutros: cleanInstructions(knowledge?.instrucoesOutros),
        taxonomiaMotivos: normalizeTaxonomy(knowledge?.taxonomiaMotivos),
        motivoAliases: normalizeAliases(knowledge?.motivoAliases),
        contextoVersao: Math.max(1, Number(knowledge?.metadata?.contextoVersao ?? 1)),
        maxTicketsPorCiclo: Math.min(200, Math.max(1, Number(defaults?.maxTicketsPorChamada ?? 60))),
        maxExemplosPorMotivo: Math.min(10, Math.max(1, Number(defaults?.maxExemplosPorMotivoNoPrompt ?? 3))),
        maxExemplosTotal: Math.min(200, Math.max(1, Number(defaults?.maxExemplosTotalNoPrompt ?? 60))),
        sourceProject: cleanText(knowledge?.metadata?.sourceProject, 100) || 'velodesk',
        sourceExportedAt: knowledge?.metadata?.exportedAt
          ? new Date(knowledge.metadata.exportedAt)
          : undefined,
      },
    },
    { upsert: true, new: true },
  );
  if (!created) throw new Error('Não foi possível criar a configuração da IA de tickets.');

  const seedExamples = knowledge?.exemplosContexto ?? [];
  if (seedExamples.length > 0) {
    await TicketIaExemplo.insertMany(
      seedExamples
        .map((item) => ({
          titulo: cleanText(item.titulo, 500),
          trecho: cleanText(item.trecho, 2000),
          motivo: cleanText(item.motivo, 200),
          confirmadoPor: 'seed',
        }))
        .filter((item) => item.trecho && item.motivo),
      { ordered: false },
    ).catch(() => undefined);
  }
  return created;
}

export async function updateTicketIaSettings(
  input: Partial<Pick<ITicketIaSettings,
    | 'contextoEmpresa'
    | 'instrucoesOutros'
    | 'taxonomiaMotivos'
    | 'motivoAliases'
    | 'maxTicketsPorCiclo'
    | 'maxExemplosPorMotivo'
    | 'maxExemplosTotal'
  >>,
  updatedBy?: string,
): Promise<ITicketIaSettings> {
  const current = await ensureTicketIaSettings();
  const update: Record<string, unknown> = { updatedBy };
  if (input.contextoEmpresa !== undefined) update.contextoEmpresa = cleanText(input.contextoEmpresa);
  if (input.instrucoesOutros !== undefined) update.instrucoesOutros = cleanInstructions(input.instrucoesOutros);
  if (input.taxonomiaMotivos !== undefined) update.taxonomiaMotivos = normalizeTaxonomy(input.taxonomiaMotivos);
  if (input.motivoAliases !== undefined) update.motivoAliases = normalizeAliases(input.motivoAliases);
  if (input.maxTicketsPorCiclo !== undefined) {
    update.maxTicketsPorCiclo = Math.min(200, Math.max(1, Number(input.maxTicketsPorCiclo)));
  }
  if (input.maxExemplosPorMotivo !== undefined) {
    update.maxExemplosPorMotivo = Math.min(10, Math.max(1, Number(input.maxExemplosPorMotivo)));
  }
  if (input.maxExemplosTotal !== undefined) {
    update.maxExemplosTotal = Math.min(200, Math.max(1, Number(input.maxExemplosTotal)));
  }
  update.contextoVersao = current.contextoVersao + 1;

  const saved = await TicketIaSettings.findOneAndUpdate(
    { key: DEFAULT_KEY },
    { $set: update },
    { new: true },
  );
  if (!saved) throw new Error('Configuração da IA não encontrada.');
  return saved;
}

export async function getTicketIaExamplesForPrompt(
  maxPerReason: number,
  maxTotal: number,
): Promise<TicketIaExamplePrompt[]> {
  const rows = await TicketIaExemplo.find({ ativo: true }).sort({ updatedAt: -1 }).lean();
  const counts = new Map<string, number>();
  const result: TicketIaExamplePrompt[] = [];
  for (const row of rows) {
    const count = counts.get(row.motivo) ?? 0;
    if (count >= maxPerReason) continue;
    result.push({ titulo: row.titulo, trecho: row.trecho, motivo: row.motivo });
    counts.set(row.motivo, count + 1);
    if (result.length >= maxTotal) break;
  }
  return result;
}

export function normalizeForComparison(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveTicketIaAlias(value: string, aliases: ITicketIaAlias[]): string | null {
  const normalized = normalizeForComparison(value);
  return aliases.find((alias) => normalizeForComparison(alias.de) === normalized)?.para ?? null;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? previous
        : 1 + Math.min(previous, dp[j], dp[j - 1]);
      previous = current;
    }
  }
  return dp[b.length];
}

export function canonicalizeTicketIaReason(value: string, taxonomy: string[]): string {
  const normalized = normalizeForComparison(value);
  const exact = taxonomy.find((item) => normalizeForComparison(item) === normalized);
  if (exact) return exact;

  let best: { value: string; distance: number } | null = null;
  for (const candidate of taxonomy) {
    const normalizedCandidate = normalizeForComparison(candidate);
    if (Math.abs(normalizedCandidate.length - normalized.length) > 4) continue;
    const distance = levenshtein(normalized, normalizedCandidate);
    const limit = Math.max(2, Math.round(normalizedCandidate.length * 0.08));
    if (distance <= limit && (!best || distance < best.distance)) {
      best = { value: candidate, distance };
    }
  }
  return best?.value ?? value;
}
