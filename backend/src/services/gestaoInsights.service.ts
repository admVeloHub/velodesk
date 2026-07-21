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

function dayKey(date: Date, tz = TZ): string {
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
function dayKeysBetween(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = new Date(range.start);
  while (cursor <= range.end) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys.length ? keys : [dayKey(range.start)];
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

function labelForDay(key: string): string {
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
  mock: { notaMedia: true };
}

/** Volume diário de tickets abertos/encerrados no período + nota média (fictícia). */
export async function getVolumeSeries(query: GestaoInsightsQuery = {}): Promise<VolumeSeriesResult> {
  const range = resolvePeriodRange(query);
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

  const series: VolumeSeriesDay[] = keys.map((key) => ({
    date: key,
    label: labelForDay(key),
    abertos: abertosMap.get(key) ?? 0,
    encerrados: encerradosMap.get(key) ?? 0,
    notaMedia: fakeNotaMediaForDay(key),
  }));

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    series,
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

const CASOS_ESPECIAIS_ORGAOS: { id: CasoEspecialEntry['id']; label: string }[] = [
  { id: 'bacen', label: 'Bacen' },
  { id: 'procon', label: 'Procon' },
  { id: 'consumidorGov', label: 'Consumidor.gov' },
  { id: 'reclameAqui', label: 'Reclame Aqui' },
];

/**
 * Totais de casos especiais por órgão/canal — fictício por ora.
 * TODO: substituir quando os canais de atendimento especiais (Bacen/Procon/Consumidor.gov/Reclame Aqui) existirem.
 */
export async function getCasosEspeciais(query: GestaoInsightsQuery = {}): Promise<CasosEspeciaisResult> {
  const range = resolvePeriodRange(query);
  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86400000) + 1);
  const seedSuffix = `${dayKey(range.start)}:${dayKey(range.end)}`;

  const items = CASOS_ESPECIAIS_ORGAOS.map((org) => {
    const ratio = seededRatio(`casos-especiais:${org.id}:${seedSuffix}`);
    const dailyBase = 1 + ratio * 3;
    const total = Math.max(0, Math.round(dailyBase * days));
    return { id: org.id, label: org.label, total };
  });

  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    items,
    mock: true,
  };
}
