/**
 * gestaoInsights.service v1.0.0 — cards analíticos da Gestão
 * Volume diário (abertos/encerrados) + nota média, top motivos por produto e casos especiais.
 */
import { ChamadoN1, IChamadoN1 } from '../models/ChamadoN1';

const TZ = 'America/Sao_Paulo';
const TERMINAL_STATUSES = new Set(['resolvido', 'cancelado', 'fechado']);

export interface GestaoInsightsQuery {
  period?: string;
  from?: string;
  to?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function dayKey(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
}

function startOfDayInTz(date: Date): Date {
  return new Date(`${dayKey(date)}T00:00:00-03:00`);
}

function endOfDayInTz(date: Date): Date {
  return new Date(`${dayKey(date)}T23:59:59.999-03:00`);
}

/**
 * Resolve o intervalo de datas a partir do período informado (hoje | ontem | mes | personalizado).
 * `7d` é um período interno usado apenas como estado inicial do card de volume (não exposto como pill).
 * Padrão (sem período válido): mês corrente.
 */
export function resolvePeriodRange(query: GestaoInsightsQuery = {}): DateRange {
  const period = String(query.period ?? 'mes').trim().toLowerCase();
  const now = new Date();

  if (period === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: startOfDayInTz(start), end: endOfDayInTz(now) };
  }

  if (period === 'hoje') {
    return { start: startOfDayInTz(now), end: endOfDayInTz(now) };
  }

  if (period === 'ontem') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: startOfDayInTz(yesterday), end: endOfDayInTz(yesterday) };
  }

  if (period === 'personalizado' && query.from && query.to) {
    const start = startOfDayInTz(new Date(query.from));
    const end = endOfDayInTz(new Date(query.to));
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { start, end };
    }
  }

  const start = new Date(now);
  start.setDate(1);
  return { start: startOfDayInTz(start), end: endOfDayInTz(now) };
}

/** Sequência de chaves de dia (YYYY-MM-DD) entre start e end, inclusive. */
export function dayKeysBetween(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [dayKey(range.start)];
}

/** Chave de mês (YYYY-MM) no fuso da Gestão — usada na visão "mês fechado" dos gráficos. */
export function monthKey(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(date);
}

const MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function labelForMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const idx = Math.min(11, Math.max(0, (m || 1) - 1));
  return `${MONTH_LABELS_PT[idx]}/${String(y).slice(-2)}`;
}

/** Sequência de chaves de mês (YYYY-MM) entre start e end, inclusive — dedup por dia para evitar armadilhas de calendário/DST. */
export function monthKeysBetween(range: DateRange): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    const key = monthKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [monthKey(range.start)];
}

/** Granularidade de exibição dos gráficos da Gestão: dia a dia ou mês fechado (jan/fev/mar…). */
export type ChartGranularity = 'dia' | 'mes';

export function resolveGranularity(query: { granularity?: string } = {}): ChartGranularity {
  return query.granularity === 'mes' ? 'mes' : 'dia';
}

/**
 * Intervalo de datas usado para montar a série do gráfico, considerando a granularidade:
 * - `dia`: respeita o período selecionado (Hoje/Ontem/Mês/Personalizado), como já era.
 * - `mes`: ignora o período diário e sempre mostra o ano corrente (jan → mês atual), permitindo
 *   comparar "mês fechado" contra mês fechado.
 */
export function resolveSeriesRange(query: GestaoInsightsQuery & { granularity?: string } = {}): {
  range: DateRange;
  granularity: ChartGranularity;
} {
  const granularity = resolveGranularity(query);
  const range = granularity === 'mes' ? getCurrentYearRange() : resolvePeriodRange(query);
  return { range, granularity };
}

export type ComparisonMode = 'mom' | 'yoy';

/**
 * Deriva o período anterior equivalente para comparação:
 * - `yoy`: mesmo intervalo de datas, um ano antes.
 * - `mom`: intervalo de mesma duração, imediatamente anterior ao início do período atual
 *   (aproxima "mês anterior" para o período "Mês" e mantém a lógica consistente para
 *   qualquer outro período — Hoje/Ontem/Personalizado).
 */
export function resolveComparisonRange(range: DateRange, mode: ComparisonMode): DateRange {
  if (mode === 'yoy') {
    const start = new Date(range.start);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(range.end);
    end.setFullYear(end.getFullYear() - 1);
    return { start, end };
  }

  const spanMs = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1000);
  const start = new Date(end.getTime() - spanMs);
  return { start: startOfDayInTz(start), end: endOfDayInTz(end) };
}

/** Início/fim do mês e do ano corrente (usados nos totais compactos dos cards de detalhe). */
export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: startOfDayInTz(start), end: endOfDayInTz(now) };
}

export function getCurrentYearRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: startOfDayInTz(start), end: endOfDayInTz(now) };
}

function getResolvedAt(chamado: IChamadoN1): Date | null {
  const regs = chamado.registro ?? [];
  for (let i = regs.length - 1; i >= 0; i--) {
    if (TERMINAL_STATUSES.has(regs[i].status)) return new Date(regs[i].data);
  }
  return null;
}

/** Primeira resposta pública do atendente (usada no prazo de 1ª resposta). */
function getFirstAgentResponseAt(chamado: IChamadoN1): Date | null {
  for (const reg of chamado.registro ?? []) {
    if (reg.origin === 'agente' && String(reg.mensagemPublica ?? '').trim()) {
      return new Date(reg.data);
    }
  }
  return null;
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function labelForDay(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ });
}

/** Hash determinístico (0–1) usado para gerar dados fictícios estáveis por seed, sem Math.random(). */
function seededRatio(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

/**
 * Nota média fictícia por dia (3.6–4.9), determinística por data.
 * TODO: substituir por CSAT real quando existir captura de avaliação do cliente.
 */
function fakeNotaMediaForDay(key: string): number {
  const ratio = seededRatio(`nota-media:${key}`);
  return Math.round((3.6 + ratio * 1.3) * 10) / 10;
}

export interface VolumeSeriesDay {
  date: string;
  label: string;
  abertos: number;
  encerrados: number;
  notaMedia: number;
}

export interface VolumeSeriesResult {
  range: { start: string; end: string };
  series: VolumeSeriesDay[];
  granularity: ChartGranularity;
  mock: { notaMedia: true };
}

/** Agrega uma série diária em buckets de mês fechado (soma para contagens, média para a nota). */
function aggregateVolumeByMonth(daily: VolumeSeriesDay[]): VolumeSeriesDay[] {
  const buckets = new Map<string, { abertos: number; encerrados: number; notaSum: number; notaN: number }>();
  const order: string[] = [];
  daily.forEach((day) => {
    const key = monthKey(new Date(`${day.date}T12:00:00`));
    if (!buckets.has(key)) {
      buckets.set(key, { abertos: 0, encerrados: 0, notaSum: 0, notaN: 0 });
      order.push(key);
    }
    const bucket = buckets.get(key)!;
    bucket.abertos += day.abertos;
    bucket.encerrados += day.encerrados;
    bucket.notaSum += day.notaMedia;
    bucket.notaN += 1;
  });
  return order.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      date: key,
      label: labelForMonth(key),
      abertos: bucket.abertos,
      encerrados: bucket.encerrados,
      notaMedia: bucket.notaN > 0 ? Math.round((bucket.notaSum / bucket.notaN) * 10) / 10 : 0,
    };
  });
}

/**
 * Volume de tickets abertos/encerrados no período + nota média (fictícia).
 * `granularity=dia` (padrão) respeita o período selecionado; `granularity=mes` sempre mostra
 * os meses fechados do ano corrente (jan, fev, mar…), permitindo comparar mês a mês.
 */
export async function getVolumeSeries(
  query: GestaoInsightsQuery & { granularity?: string } = {},
): Promise<VolumeSeriesResult> {
  const { range, granularity } = resolveSeriesRange(query);
  const keys = dayKeysBetween(range);

  const abertosMap = new Map<string, number>(keys.map((k) => [k, 0]));
  const encerradosMap = new Map<string, number>(keys.map((k) => [k, 0]));

  const chamados = await ChamadoN1.find({
    $or: [
      { createdAt: { $gte: range.start, $lte: range.end } },
      { 'registro.data': { $gte: range.start, $lte: range.end } },
    ],
  })
    .select('createdAt registro')
    .lean<IChamadoN1[]>();

  chamados.forEach((chamado) => {
    const createdAt = chamado.createdAt ? new Date(chamado.createdAt) : null;
    if (createdAt && createdAt >= range.start && createdAt <= range.end) {
      const key = dayKey(createdAt);
      if (abertosMap.has(key)) abertosMap.set(key, (abertosMap.get(key) ?? 0) + 1);
    }

    const resolvedAt = getResolvedAt(chamado);
    if (resolvedAt && resolvedAt >= range.start && resolvedAt <= range.end) {
      const key = dayKey(resolvedAt);
      if (encerradosMap.has(key)) encerradosMap.set(key, (encerradosMap.get(key) ?? 0) + 1);
    }
  });

  const dailySeries: VolumeSeriesDay[] = keys.map((key) => ({
    date: key,
    label: labelForDay(key),
    abertos: abertosMap.get(key) ?? 0,
    encerrados: encerradosMap.get(key) ?? 0,
    notaMedia: fakeNotaMediaForDay(key),
  }));

  const series = granularity === 'mes' ? aggregateVolumeByMonth(dailySeries) : dailySeries;

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    series,
    granularity,
    mock: { notaMedia: true },
  };
}

/** Status considerados "Em Aberto" para os cards de resumo (não inclui o status literal `em-aberto`, a pedido). */
const EM_ABERTO_STATUSES = ['novo', 'em-andamento', 'pendente'];

function lastStatus(chamado: IChamadoN1): string {
  const regs = chamado.registro ?? [];
  return regs.length ? regs[regs.length - 1].status || 'novo' : 'novo';
}

/** Filtro Mongo — chamados cujo último status esteja entre os informados. */
function lastStatusInFilter(statuses: string[]): Record<string, unknown> {
  return {
    $expr: {
      $in: [
        { $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'] },
        statuses,
      ],
    },
  };
}

export interface OldestAbertoEntry {
  id: string;
  protocolo: string;
  titulo: string;
  produto: string;
  motivo: string;
  status: string;
  createdAt: string;
  ageDays: number;
}

export interface VolumeSummaryResult {
  range: { start: string; end: string };
  totalAbertos: number;
  totalNovo: number;
  totalEmAberto: number;
  oldestAbertos: OldestAbertoEntry[];
  tmaMedio: string | null;
  tmeMedio: string | null;
}

/**
 * Resumo do card de Volume de tickets: totais no período selecionado (abertos, novos, em aberto),
 * TMA/TME médios dos tickets resolvidos no período + os 10 tickets "em aberto" mais antigos
 * (sempre em relação ao acervo completo, não filtrado por período).
 */
export async function getVolumeSummary(query: GestaoInsightsQuery = {}): Promise<VolumeSummaryResult> {
  const range = resolvePeriodRange(query);

  const chamadosNoPeriodo = await ChamadoN1.find({
    createdAt: { $gte: range.start, $lte: range.end },
  })
    .select('createdAt registro.status')
    .lean<IChamadoN1[]>();

  let totalNovo = 0;
  let totalEmAberto = 0;
  chamadosNoPeriodo.forEach((chamado) => {
    const status = lastStatus(chamado);
    if (status === 'novo') totalNovo++;
    if (EM_ABERTO_STATUSES.includes(status)) totalEmAberto++;
  });

  const resolvidosNoPeriodo = await ChamadoN1.find({
    'registro.data': { $gte: range.start, $lte: range.end },
  })
    .select('createdAt registro')
    .lean<IChamadoN1[]>();

  let tmaSumMs = 0;
  let tmaN = 0;
  let tmeSumMs = 0;
  let tmeN = 0;
  resolvidosNoPeriodo.forEach((chamado) => {
    const resolvedAt = getResolvedAt(chamado);
    if (!resolvedAt || resolvedAt < range.start || resolvedAt > range.end) return;
    const createdAt = chamado.createdAt ? new Date(chamado.createdAt) : resolvedAt;
    tmaSumMs += resolvedAt.getTime() - createdAt.getTime();
    tmaN++;
    const firstResponseAt = getFirstAgentResponseAt(chamado);
    if (firstResponseAt) {
      tmeSumMs += firstResponseAt.getTime() - createdAt.getTime();
      tmeN++;
    }
  });

  const oldestDocs = await ChamadoN1.find(lastStatusInFilter(EM_ABERTO_STATUSES))
    .sort({ createdAt: 1 })
    .limit(10)
    .select('chamadoProtocolo chamadoTitulo createdAt tabulacao registro.status')
    .lean<IChamadoN1[]>();

  const now = Date.now();
  const oldestAbertos: OldestAbertoEntry[] = oldestDocs.map((chamado) => {
    const tab = chamado.tabulacao?.[chamado.tabulacao.length - 1];
    const createdAt = chamado.createdAt ? new Date(chamado.createdAt) : new Date();
    return {
      id: String((chamado as unknown as { _id: unknown })._id),
      protocolo: chamado.chamadoProtocolo ?? '',
      titulo: chamado.chamadoTitulo || tab?.motivo || 'Sem título',
      produto: tab?.produto ?? '',
      motivo: tab?.motivo ?? '',
      status: lastStatus(chamado),
      createdAt: createdAt.toISOString(),
      ageDays: Math.max(0, Math.floor((now - createdAt.getTime()) / 86400000)),
    };
  });

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    totalAbertos: chamadosNoPeriodo.length,
    totalNovo,
    totalEmAberto,
    oldestAbertos,
    tmaMedio: tmaN > 0 ? formatDurationMs(tmaSumMs / tmaN) : null,
    tmeMedio: tmeN > 0 ? formatDurationMs(tmeSumMs / tmeN) : null,
  };
}

export interface TopMotivoEntry {
  produto: string;
  motivo: string;
  count: number;
  pct: number;
}

export interface TopMotivosResult {
  range: { start: string; end: string };
  total: number;
  items: TopMotivoEntry[];
}

/** Top motivos de acionamento (consolidado da tabulação), separados por produto, no período. */
export async function getTopMotivosPorProduto(
  query: GestaoInsightsQuery = {},
  limit = 10
): Promise<TopMotivosResult> {
  const range = resolvePeriodRange(query);

  const chamados = await ChamadoN1.find({
    createdAt: { $gte: range.start, $lte: range.end },
  })
    .select('createdAt tabulacao')
    .lean<IChamadoN1[]>();

  const counts = new Map<string, TopMotivoEntry>();
  let total = 0;

  chamados.forEach((chamado) => {
    const tab = chamado.tabulacao?.[chamado.tabulacao.length - 1];
    const produto = String(tab?.produto ?? '').trim();
    const motivo = String(tab?.motivo ?? '').trim();
    if (!produto || !motivo) return;

    total++;
    const key = `${produto}::${motivo}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { produto, motivo, count: 1, pct: 0 });
    }
  });

  const items = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      pct: total > 0 ? Math.round((entry.count / total) * 1000) / 10 : 0,
    }));

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    total,
    items,
  };
}

export interface CasoEspecialEntry {
  id: 'bacen' | 'procon' | 'consumidorGov' | 'reclameAqui';
  label: string;
  total: number;
}

export interface CasosEspeciaisResult {
  range: { start: string; end: string };
  items: CasoEspecialEntry[];
  mock: true;
}

export const CASOS_ESPECIAIS_ORGAOS: { id: CasoEspecialEntry['id']; label: string }[] = [
  { id: 'bacen', label: 'Bacen' },
  { id: 'procon', label: 'Procon' },
  { id: 'consumidorGov', label: 'Consumidor.gov' },
  { id: 'reclameAqui', label: 'Reclame Aqui' },
];

/** Base diária fictícia (determinística) de casos por órgão — usada tanto no total do card quanto na série do detalhe. */
function casoEspecialDailyTotal(orgaoId: string, key: string): number {
  const ratio = seededRatio(`casos-especiais-daily:${orgaoId}:${key}`);
  return Math.max(0, Math.round(1 + ratio * 4));
}

function casoEspecialTotalForRange(orgaoId: string, range: DateRange): number {
  return dayKeysBetween(range).reduce((sum, key) => sum + casoEspecialDailyTotal(orgaoId, key), 0);
}

/**
 * Totais de casos especiais por órgão/canal — fictício por ora.
 * TODO: substituir quando os canais de atendimento especiais (Bacen/Procon/Consumidor.gov/Reclame Aqui) existirem.
 */
export async function getCasosEspeciais(query: GestaoInsightsQuery = {}): Promise<CasosEspeciaisResult> {
  const range = resolvePeriodRange(query);

  const items = CASOS_ESPECIAIS_ORGAOS.map((org) => ({
    id: org.id,
    label: org.label,
    total: casoEspecialTotalForRange(org.id, range),
  }));

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    items,
    mock: true,
  };
}

const CASOS_ESPECIAIS_MOTIVOS = [
  'Cobrança indevida',
  'Divergência de valores',
  'Demora no atendimento',
  'Solicitação de cancelamento',
  'Negativação indevida',
  'Falha no sistema/app',
  'Informação insuficiente',
  'Descumprimento de prazo',
];

const DEFAULT_PRODUTOS_FALLBACK = ['Cartão', 'Empréstimo', 'Conta Digital', 'Seguros'];

/** Produtos reais mais frequentes na tabulação de tickets — usados como recorte para os motivos fictícios do detalhe. */
async function getReferenceProdutos(limit = 6): Promise<string[]> {
  try {
    const rows = await ChamadoN1.aggregate<{ _id: string; count: number }>([
      { $unwind: '$tabulacao' },
      { $match: { 'tabulacao.produto': { $nin: [null, ''] } } },
      { $group: { _id: '$tabulacao.produto', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
    const produtos = rows.map((r) => String(r._id)).filter(Boolean);
    return produtos.length ? produtos : DEFAULT_PRODUTOS_FALLBACK;
  } catch {
    return DEFAULT_PRODUTOS_FALLBACK;
  }
}

export interface CasoEspecialSeriesDay {
  date: string;
  label: string;
  total: number;
  totalAnterior?: number;
}

export interface CasoEspecialMotivoProduto {
  produto: string;
  total: number;
  motivos: { motivo: string; count: number; pct: number }[];
}

export interface CasoEspecialDetailResult {
  orgao: { id: CasoEspecialEntry['id']; label: string };
  range: { start: string; end: string };
  totals: { currentMonth: number; currentYear: number };
  series: CasoEspecialSeriesDay[];
  granularity: ChartGranularity;
  comparison?: { mode: ComparisonMode; range: { start: string; end: string } };
  motivosPorProduto: CasoEspecialMotivoProduto[];
  mock: true;
}

/** Agrega a série diária de um caso especial em buckets de mês fechado (soma de casos). */
function aggregateCasoEspecialByMonth(daily: CasoEspecialSeriesDay[]): CasoEspecialSeriesDay[] {
  const buckets = new Map<string, { total: number; totalAnterior: number; hasAnterior: boolean }>();
  const order: string[] = [];
  daily.forEach((day) => {
    const key = monthKey(new Date(`${day.date}T12:00:00`));
    if (!buckets.has(key)) {
      buckets.set(key, { total: 0, totalAnterior: 0, hasAnterior: false });
      order.push(key);
    }
    const bucket = buckets.get(key)!;
    bucket.total += day.total;
    if (day.totalAnterior != null) {
      bucket.totalAnterior += day.totalAnterior;
      bucket.hasAnterior = true;
    }
  });
  return order.map((key) => {
    const bucket = buckets.get(key)!;
    return {
      date: key,
      label: labelForMonth(key),
      total: bucket.total,
      ...(bucket.hasAnterior ? { totalAnterior: bucket.totalAnterior } : {}),
    };
  });
}

/**
 * Detalhe (fictício) de um órgão/canal de caso especial: totais mês/ano, série do gráfico
 * (com comparativo opcional MoM/YoY, em granularidade dia ou mês fechado) e principais motivos por produto.
 */
export async function getCasoEspecialDetail(
  orgaoId: string,
  query: GestaoInsightsQuery & { compare?: string; granularity?: string } = {},
): Promise<CasoEspecialDetailResult | null> {
  const org = CASOS_ESPECIAIS_ORGAOS.find((o) => o.id === orgaoId);
  if (!org) return null;

  const { range, granularity } = resolveSeriesRange(query);
  const compareMode: ComparisonMode | undefined =
    query.compare === 'mom' || query.compare === 'yoy' ? query.compare : undefined;

  const currentMonth = casoEspecialTotalForRange(org.id, getCurrentMonthRange());
  const currentYear = casoEspecialTotalForRange(org.id, getCurrentYearRange());

  const keys = dayKeysBetween(range);
  let comparisonRange: DateRange | undefined;
  let comparisonKeys: string[] = [];
  if (compareMode) {
    comparisonRange = resolveComparisonRange(range, compareMode);
    comparisonKeys = dayKeysBetween(comparisonRange);
  }

  const dailySeries: CasoEspecialSeriesDay[] = keys.map((key, idx) => {
    const prevKey = comparisonKeys[idx];
    return {
      date: key,
      label: labelForDay(key),
      total: casoEspecialDailyTotal(org.id, key),
      ...(prevKey ? { totalAnterior: casoEspecialDailyTotal(org.id, prevKey) } : {}),
    };
  });

  const series = granularity === 'mes' ? aggregateCasoEspecialByMonth(dailySeries) : dailySeries;

  const produtos = await getReferenceProdutos();
  const motivosPorProduto: CasoEspecialMotivoProduto[] = produtos.map((produto) => {
    const motivos = CASOS_ESPECIAIS_MOTIVOS
      .map((motivo) => {
        const ratio = seededRatio(`caso-motivo:${org.id}:${produto}:${motivo}`);
        return { motivo, count: Math.max(1, Math.round(3 + ratio * 22)) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const total = motivos.reduce((sum, m) => sum + m.count, 0);
    return {
      produto,
      total,
      motivos: motivos.map((m) => ({
        ...m,
        pct: total > 0 ? Math.round((m.count / total) * 1000) / 10 : 0,
      })),
    };
  });

  return {
    orgao: { id: org.id, label: org.label },
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    totals: { currentMonth, currentYear },
    series,
    granularity,
    comparison:
      compareMode && comparisonRange
        ? {
            mode: compareMode,
            range: { start: comparisonRange.start.toISOString(), end: comparisonRange.end.toISOString() },
          }
        : undefined,
    motivosPorProduto,
    mock: true,
  };
}
