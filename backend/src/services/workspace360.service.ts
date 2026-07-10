/** workspace360.service v1.0.0 — agregações Painel 360° sobre chamados_n1 */
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';
import type { AuthPayload } from '../middleware/auth';
import {
  buildResponsavelCandidates,
  chamadoToTicket,
  currentStatus,
  isSlaBreached,
  meusChamadosResponsavelFilter,
} from './chamado.mapper';

const SLA_LIMIT_HOURS: Record<string, number> = {
  'em-aberto': 4,
  'em-andamento': 8,
};

const SLA_TRACKED = new Set(['em-aberto', 'em-andamento']);
const ACTIVE_STATUSES = new Set(['novo', 'em-aberto', 'em-andamento', 'pendente', 'em-espera']);

const FINANCEIRO_KW = ['financeiro', 'cobrança', 'cobranca', 'fatura', 'inadimplência', 'inadimplencia'];
const ESTORNO_KW = ['estorno', 'procon', 'devolução', 'devolucao'];
const ESCALONAR_VALUES = new Set(['financeiro', 'n2', 'suporte']);

const TZ = 'America/Sao_Paulo';

export interface Workspace360Query {
  period?: string;
  channel?: string;
  team?: string;
  report?: string;
}

function startOfDayInTz(date: Date, tz = TZ): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
}

function isSameDayInTz(a: Date, b: Date, tz = TZ): boolean {
  const fmt = (dt: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  return fmt(a) === fmt(b);
}

function periodRange(period = '7d'): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  if (period === 'today') {
    return { from: startOfDayInTz(to), to };
  }
  if (period === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (period === '30d') {
    from.setDate(from.getDate() - 30);
    return { from, to };
  }
  from.setDate(from.getDate() - 7);
  return { from, to };
}

function normalizeAlteracoes(alt: unknown): Record<string, unknown>[] {
  if (Array.isArray(alt)) {
    return alt.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown>[];
  }
  if (alt && typeof alt === 'object') return [alt as Record<string, unknown>];
  return [];
}

function getLastEscalonar(chamado: IChamadoN1): string {
  let last = '';
  for (const reg of chamado.registro ?? []) {
    for (const alt of normalizeAlteracoes(reg.alteracoes)) {
      const val = String(alt.escalonar ?? '').trim();
      if (val) last = val;
    }
  }
  return last;
}

function tabulacaoText(chamado: IChamadoN1): string {
  const tab = chamado.tabulacao?.[chamado.tabulacao.length - 1];
  return [chamado.chamadoTitulo, tab?.tipoChamado, tab?.produto, tab?.motivo, tab?.detalhe]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function responsavelMatches(chamado: IChamadoN1, candidates: string[]): boolean {
  const resp = (chamado.tabulacao?.[chamado.tabulacao.length - 1]?.responsavel ?? '').trim().toLowerCase();
  if (!resp) return false;
  return candidates.includes(resp);
}

function getResolvedAt(chamado: IChamadoN1): Date | null {
  const regs = chamado.registro ?? [];
  for (let i = regs.length - 1; i >= 0; i--) {
    if (regs[i].status === 'resolvido') return new Date(regs[i].data);
  }
  return null;
}

function getFirstAgentResponseAt(chamado: IChamadoN1): Date | null {
  for (const reg of chamado.registro ?? []) {
    if (reg.origin === 'agente' && String(reg.mensagemPublica ?? '').trim()) {
      return new Date(reg.data);
    }
  }
  return null;
}

function slaRemainingMinutes(chamado: IChamadoN1): number | null {
  const status = currentStatus(chamado);
  if (!SLA_TRACKED.has(status)) return null;
  const limitHours = SLA_LIMIT_HOURS[status];
  if (!limitHours) return null;
  const regs = chamado.registro ?? [];
  const statusSince = regs[regs.length - 1]?.data ?? chamado.createdAt;
  if (!statusSince) return null;
  const elapsedMin = Math.max(0, Math.floor((Date.now() - new Date(statusSince).getTime()) / 60000));
  const totalMin = limitHours * 60;
  return totalMin - elapsedMin;
}

function isSlaAtRisk(chamado: IChamadoN1): boolean {
  if (isSlaBreached(chamado)) return true;
  const remaining = slaRemainingMinutes(chamado);
  if (remaining == null) return false;
  const status = currentStatus(chamado);
  const limitHours = SLA_LIMIT_HOURS[status];
  if (!limitHours) return false;
  const totalMin = limitHours * 60;
  return remaining <= Math.max(30, Math.floor(totalMin * 0.2));
}

function slaStatus(chamado: IChamadoN1): 'critical' | 'warning' | 'ok' {
  if (isSlaBreached(chamado)) return 'critical';
  const remaining = slaRemainingMinutes(chamado);
  if (remaining != null && remaining <= 30) return 'warning';
  if (isSlaAtRisk(chamado)) return 'warning';
  return 'ok';
}

function inferChannel(chamado: IChamadoN1): string {
  for (const reg of chamado.registro ?? []) {
    const meta = reg.metadados ?? {};
    if (meta.emailMessageId || meta.emailFrom) return 'email';
    if (meta.whatsapp || meta.waChatId || meta.channel === 'whatsapp') return 'whatsapp';
    if (String(meta.channel ?? '').toLowerCase().includes('instagram')) return 'instagram';
    if (String(meta.channel ?? '').toLowerCase().includes('chat')) return 'chat';
  }
  return 'portal';
}

function channelMatchesFilter(chamado: IChamadoN1, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  const ch = inferChannel(chamado);
  if (filter === 'telefone') return ch === 'telefone';
  return ch === filter;
}

function statusToQueueId(status: string): string {
  if (status === 'novo' || status === 'em-aberto') return 'novos';
  if (status === 'pendente' || status === 'em-espera') return 'pendente';
  if (status === 'em-andamento') return 'em-andamento';
  if (status === 'resolvido') return 'resolvidos';
  return 'novos';
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}m ${String(m).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatDurationMinutes(totalMin: number): string {
  return formatDurationMs(Math.max(0, Math.round(totalMin)) * 60000);
}

function isEscalationCandidate(chamado: IChamadoN1): boolean {
  const status = currentStatus(chamado);
  if (!ACTIVE_STATUSES.has(status)) return false;
  if (!isSlaBreached(chamado) && !isSlaAtRisk(chamado)) return false;
  const escalonar = getLastEscalonar(chamado);
  if (escalonar && ESCALONAR_VALUES.has(escalonar)) return true;
  const text = tabulacaoText(chamado);
  return matchesKeywords(text, [...FINANCEIRO_KW, ...ESTORNO_KW]);
}

function escalationCategory(chamado: IChamadoN1): 'financeiro' | 'estorno' | null {
  if (!isEscalationCandidate(chamado)) return null;
  const escalonar = getLastEscalonar(chamado);
  const text = tabulacaoText(chamado);
  if (escalonar === 'financeiro' || matchesKeywords(text, FINANCEIRO_KW)) return 'financeiro';
  if (matchesKeywords(text, ESTORNO_KW)) return 'estorno';
  if (escalonar && ESCALONAR_VALUES.has(escalonar)) return 'financeiro';
  return null;
}

async function loadAllChamados(): Promise<IChamadoN1[]> {
  return ChamadoN1.find().sort({ updatedAt: -1 }).lean<IChamadoN1[]>();
}

async function loadAgentChamados(candidates: string[]): Promise<IChamadoN1[]> {
  const filter = meusChamadosResponsavelFilter(candidates);
  return ChamadoN1.find(filter).sort({ updatedAt: -1 }).lean<IChamadoN1[]>();
}

async function resolveDbUser(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select('name email').lean();
}

async function enrichTicketForPanel(chamado: IChamadoN1, queueId: string) {
  const remaining = slaRemainingMinutes(chamado);
  const status = slaStatus(chamado);
  const dto = await chamadoToTicket(chamado, queueId);
  return {
    ticket: {
      ...dto,
      id: chamado._id?.toString(),
      slaRemaining: remaining,
      slaStatus: status,
      channel: inferChannel(chamado),
    },
    queueId,
    sla: status,
  };
}

function classifyAgentSection(chamado: IChamadoN1): 'action-now' | 'client-replied' | 'workflow' | null {
  const status = currentStatus(chamado);
  const qid = statusToQueueId(status);
  if (qid === 'pendente') return 'client-replied';
  if (qid === 'em-andamento') return 'workflow';
  if (status === 'novo' || status === 'em-aberto' || isSlaAtRisk(chamado)) return 'action-now';
  return null;
}

export async function buildAgent360Payload(authUser: AuthPayload) {
  const dbUser = await resolveDbUser(authUser.userId);
  const candidates = buildResponsavelCandidates(authUser, dbUser);
  const chamados = await loadAgentChamados(candidates);
  const now = new Date();
  const todayStart = startOfDayInTz(now);

  const active = chamados.filter((c) => ACTIVE_STATUSES.has(currentStatus(c)));
  const resolvedTodayList = chamados.filter((c) => {
    if (currentStatus(c) !== 'resolvido') return false;
    const resolvedAt = getResolvedAt(c);
    return resolvedAt ? resolvedAt >= todayStart : false;
  });

  const slaAtRiskList = chamados.filter(
    (c) => ACTIVE_STATUSES.has(currentStatus(c)) && isSlaAtRisk(c)
  );

  let tmaTotalMin = 0;
  let tmaCount = 0;
  resolvedTodayList.forEach((c) => {
    const resolvedAt = getResolvedAt(c);
    if (!resolvedAt) return;
    const start = c.createdAt ? new Date(c.createdAt) : resolvedAt;
    tmaTotalMin += (resolvedAt.getTime() - start.getTime()) / 60000;
    tmaCount++;
  });

  const buckets: Record<string, Awaited<ReturnType<typeof enrichTicketForPanel>>[]> = {
    'action-now': [],
    'client-replied': [],
    workflow: [],
  };

  await Promise.all(
    active.map(async (c) => {
      const section = classifyAgentSection(c);
      if (!section) return;
      const entry = await enrichTicketForPanel(c, statusToQueueId(currentStatus(c)));
      buckets[section].push(entry);
    })
  );

  Object.keys(buckets).forEach((key) => {
    buckets[key].sort((a, b) => {
      const prio: Record<string, number> = { critical: 0, warning: 1, ok: 2 };
      return (prio[a.sla] ?? 9) - (prio[b.sla] ?? 9);
    });
  });

  const productionMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    productionMap.set(
      new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d),
      0
    );
  }
  chamados.forEach((c) => {
    if (currentStatus(c) !== 'resolvido') return;
    const resolvedAt = getResolvedAt(c);
    if (!resolvedAt) return;
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(resolvedAt);
    if (productionMap.has(key)) productionMap.set(key, (productionMap.get(key) ?? 0) + 1);
  });

  const productionWeek = [...productionMap.entries()].map(([id, value], index, arr) => {
    const date = new Date(`${id}T12:00:00`);
    const isToday = index === arr.length - 1;
    const weekday = date
      .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: TZ })
      .replace('.', '')
      .replace(/^\w/, (c) => c.toUpperCase());
    const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ });
    return {
      id,
      label: isToday ? 'Hoje' : `${weekday} ${dateLabel}`,
      value,
      isToday,
    };
  });
  const maxProd = Math.max(...productionWeek.map((d) => d.value), 1);
  const productionWeekPct = productionWeek.map((day) => ({
    ...day,
    pct: Math.round((day.value / maxProd) * 100),
  }));

  const criticalEntry = [...buckets['action-now'], ...buckets.workflow, ...buckets['client-replied']]
    .filter((e) => e.sla === 'critical')
    .sort((a, b) => (a.ticket.slaRemaining ?? 999) - (b.ticket.slaRemaining ?? 999))[0];

  let alert = null;
  if (criticalEntry) {
    const t = criticalEntry.ticket as Record<string, unknown>;
    alert = {
      ticketId: String(t.id),
      clientName: t.clientName || 'Cliente',
      subject: String(t.title || 'Ticket').split('—')[0].trim() || t.title,
      expiresIn: `${Math.max(0, (t.slaRemaining as number) ?? 0)} minutos`,
    };
  }

  const sectionDefs = [
    { id: 'action-now', title: 'Precisa de ação agora', icon: 'ti ti-alert-circle', variant: 'urgent' },
    { id: 'client-replied', title: 'Cliente respondeu', icon: 'ti ti-message-circle', variant: 'replied' },
    { id: 'workflow', title: 'Atualização interna / workflow', icon: 'ti ti-arrows-exchange', variant: 'workflow' },
  ];

  const sections = sectionDefs.map((def) => ({
    ...def,
    count: buckets[def.id]?.length ?? 0,
    entries: (buckets[def.id] ?? []).slice(0, 5),
  }));

  return {
    kpis: {
      assigned: active.length,
      resolvedToday: resolvedTodayList.length,
      slaAtRisk: slaAtRiskList.length,
      csat: null,
      tma: tmaCount > 0 ? formatDurationMinutes(tmaTotalMin / tmaCount) : null,
    },
    sections,
    productionWeek: productionWeekPct,
    alert,
  };
}

export async function buildSupervisor360Payload(authUser: AuthPayload, query: Workspace360Query = {}) {
  const chamados = await loadAllChamados();
  const { from, to } = periodRange(query.period ?? '7d');
  const filtered = chamados.filter((c) => channelMatchesFilter(c, query.channel ?? 'all'));

  const active = filtered.filter((c) => ACTIVE_STATUSES.has(currentStatus(c)));
  const slaRisk = active.filter((c) => isSlaAtRisk(c)).length;

  const resolvedInPeriod = filtered.filter((c) => {
    if (currentStatus(c) !== 'resolvido') return false;
    const at = getResolvedAt(c);
    return at ? at >= from && at <= to : false;
  });

  const resolvedCompliant = resolvedInPeriod.filter((c) => !wasResolvedWithSlaBreach(c)).length;
  const slaPct = resolvedInPeriod.length
    ? Math.round((resolvedCompliant / resolvedInPeriod.length) * 100)
    : 0;

  let tmaSum = 0;
  let tmaN = 0;
  let tmeSum = 0;
  let tmeN = 0;
  resolvedInPeriod.forEach((c) => {
    const resolvedAt = getResolvedAt(c);
    if (!resolvedAt) return;
    const start = c.createdAt ? new Date(c.createdAt) : resolvedAt;
    tmaSum += resolvedAt.getTime() - start.getTime();
    tmaN++;
    const firstAgent = getFirstAgentResponseAt(c);
    if (firstAgent) {
      tmeSum += firstAgent.getTime() - start.getTime();
      tmeN++;
    }
  });

  const createdInPeriod = filtered.filter((c) => {
    const created = c.createdAt ? new Date(c.createdAt) : null;
    return created ? created >= from && created <= to : false;
  }).length;

  const escalatedTickets = filtered.filter((c) => escalationCategory(c) !== null);
  const categories = [
    { id: 'financeiro', label: 'Financeiro', count: 0, accent: 'orange' },
    { id: 'estorno', label: 'Estorno', count: 0, accent: 'navy' },
  ];
  const escalatedGroups: Record<string, IChamadoN1[]> = { financeiro: [], estorno: [] };
  escalatedTickets.forEach((c) => {
    const cat = escalationCategory(c);
    if (!cat) return;
    escalatedGroups[cat].push(c);
    const row = categories.find((x) => x.id === cat);
    if (row) row.count++;
  });

  const slaCriticalCount = escalatedTickets.filter((c) => isSlaBreached(c)).length;

  const escalatedGroupEntries = await Promise.all(
    categories.map(async (cat) => ({
      ...cat,
      entries: await Promise.all(
        (escalatedGroups[cat.id] ?? []).slice(0, 20).map((c) =>
          enrichTicketForPanel(c, statusToQueueId(currentStatus(c)))
        )
      ),
    }))
  );

  const channelIds = ['whatsapp', 'email', 'chat', 'instagram', 'portal'] as const;
  const channelVision = channelIds.map((id) => {
    const inChannel = active.filter((c) => inferChannel(c) === id || (id === 'portal' && !['whatsapp', 'email', 'chat', 'instagram'].includes(inferChannel(c))));
    const total = inChannel.length;
    const ok = inChannel.filter((c) => !isSlaAtRisk(c)).length;
    const sla = total ? Math.round((ok / total) * 100) : 0;
    return {
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      tickets: total,
      sla,
      highVolume: false,
    };
  });
  const avgTickets = channelVision.reduce((s, c) => s + c.tickets, 0) / Math.max(channelVision.length, 1);
  channelVision.forEach((c) => {
    c.highVolume = c.tickets > avgTickets * 1.3;
  });

  const leaderboard = await buildLeaderboard(filtered, from, to);
  const reports: Record<string, unknown> = {};
  if (query.report) {
    reports[query.report] = buildReport(query.report, filtered, query);
  }

  return {
    kpis: {
      slaPct,
      slaRisk,
      online: null,
      tma: tmaN ? formatDurationMs(tmaSum / tmaN) : '—',
      tme: tmeN ? formatDurationMs(tmeSum / tmeN) : '—',
      nps: null,
      volume: String(createdInPeriod),
      warRoom: false,
    },
    escalated: {
      categories,
      slaCriticalCount,
      updatedAt: new Date().toISOString(),
      groups: escalatedGroupEntries,
    },
    channelVision,
    leaderboard,
    reports,
  };
}

function wasResolvedWithSlaBreach(chamado: IChamadoN1): boolean {
  const regs = chamado.registro ?? [];
  for (let i = regs.length - 1; i >= 0; i--) {
    if (regs[i].status !== 'resolvido') continue;
    const snapshot = { ...chamado, registro: regs.slice(0, i + 1) } as IChamadoN1;
    return isSlaBreached(snapshot);
  }
  return false;
}

async function buildLeaderboard(chamados: IChamadoN1[], from: Date, to: Date) {
  const users = await User.find({ role: { $in: ['agent', 'supervisor'] } }).select('name email').lean();
  const userByKey = new Map<string, string>();
  users.forEach((u) => {
    userByKey.set(u.email.toLowerCase(), u.name);
    userByKey.set(u.name.toLowerCase(), u.name);
    const local = u.email.split('@')[0]?.toLowerCase();
    if (local) userByKey.set(local, u.name);
  });

  const byAgent = new Map<string, { resolved: number; resolvedToday: number; resolvedYesterday: number; slaOk: number; slaTotal: number; tmaSum: number; tmaN: number }>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  chamados.forEach((c) => {
    const resp = (c.tabulacao?.[c.tabulacao.length - 1]?.responsavel ?? '').trim().toLowerCase();
    if (!resp) return;
    if (!byAgent.has(resp)) {
      byAgent.set(resp, { resolved: 0, resolvedToday: 0, resolvedYesterday: 0, slaOk: 0, slaTotal: 0, tmaSum: 0, tmaN: 0 });
    }
    const row = byAgent.get(resp)!;
    if (currentStatus(c) !== 'resolvido') return;
    const resolvedAt = getResolvedAt(c);
    if (!resolvedAt || resolvedAt < from || resolvedAt > to) return;
    row.resolved++;
    if (isSameDayInTz(resolvedAt, today)) row.resolvedToday++;
    if (isSameDayInTz(resolvedAt, yesterday)) row.resolvedYesterday++;
    row.slaTotal++;
    if (!wasResolvedWithSlaBreach(c)) row.slaOk++;
    const start = c.createdAt ? new Date(c.createdAt) : resolvedAt;
    row.tmaSum += resolvedAt.getTime() - start.getTime();
    row.tmaN++;
  });

  const entries = [...byAgent.entries()].map(([key, stats], index) => {
    const name = userByKey.get(key) ?? key;
    const delta = stats.resolvedYesterday
      ? Math.round(((stats.resolvedToday - stats.resolvedYesterday) / stats.resolvedYesterday) * 100)
      : stats.resolvedToday > 0 ? 100 : 0;
    return {
      id: key.replace(/\s+/g, '-'),
      rank: index + 1,
      name,
      trend: delta >= 0 ? 'up' : 'down',
      medal: index === 0,
      sla: stats.slaTotal ? `${Math.round((stats.slaOk / stats.slaTotal) * 100)}%` : '—',
      resolved: stats.resolved,
      tma: stats.tmaN ? formatDurationMs(stats.tmaSum / stats.tmaN) : '—',
      csat: null,
      vsYesterday: `${delta >= 0 ? '+' : ''}${delta}%`,
      shift: null,
      channel: null,
    };
  });

  entries.sort((a, b) => b.resolved - a.resolved);
  entries.forEach((e, i) => { e.rank = i + 1; e.medal = i === 0; });
  return entries.slice(0, 20);
}

function buildReport(reportId: string, chamados: IChamadoN1[], query: Workspace360Query) {
  const { from, to } = periodRange(query.period ?? '7d');
  const cardMeta: Record<string, { icon: string; title: string; desc: string; action: string }> = {
    sla: { icon: 'ti-clock', title: 'SLA operacional', desc: 'Cumprimento de prazos por fila, canal e equipe.', action: 'Ver relatório SLA' },
    volume: { icon: 'ti-chart-bar', title: 'Volume de tickets', desc: 'Entradas, resolvidos e backlog por período.', action: 'Ver relatório de volume' },
    nps: { icon: 'ti-mood-smile', title: 'NPS e satisfação', desc: 'Notas de atendimento e tendência semanal.', action: 'Ver relatório NPS' },
    team: { icon: 'ti-users', title: 'Performance da equipe', desc: 'TMA, TME e produtividade por agente.', action: 'Ver relatório de equipe' },
    monitoria: { icon: 'ti-headphones', title: 'Monitoria', desc: 'Scorecards, avaliações de qualidade e feedback por agente.', action: 'Abrir monitoria' },
  };

  const meta = cardMeta[reportId];
  if (!meta) return null;

  if (reportId === 'nps' || reportId === 'monitoria') {
    return {
      ...meta,
      id: reportId,
      generatedAt: new Date().toLocaleString('pt-BR'),
      filters: { period: query.period, channel: query.channel, team: query.team },
      summary: [
        { label: reportId === 'nps' ? 'NPS' : 'Score médio', value: '—' },
        { label: reportId === 'nps' ? 'CSAT médio' : 'Avaliações', value: 'Sem dados' },
        { label: reportId === 'nps' ? 'Respostas' : 'Feedback pendente', value: '—' },
      ],
      columns: reportId === 'nps'
        ? ['Semana', 'NPS', 'CSAT', 'Respostas', 'Tendência']
        : ['Agente', 'Score', 'Avaliações', 'Conformidade', 'Feedback'],
      rows: [],
    };
  }

  if (reportId === 'sla') {
    const rows: string[][] = [];
    const statuses = ['novo', 'em-aberto', 'em-andamento', 'pendente'];
    statuses.forEach((st) => {
      ['email', 'whatsapp', 'portal'].forEach((ch) => {
        const subset = chamados.filter((c) => currentStatus(c) === st && inferChannel(c) === ch);
        if (!subset.length) return;
        const ok = subset.filter((c) => !isSlaAtRisk(c)).length;
        rows.push([
          st,
          ch,
          'N1',
          `${Math.round((ok / subset.length) * 100)}%`,
          '—',
        ]);
      });
    });
    const resolved = chamados.filter((c) => {
      if (currentStatus(c) !== 'resolvido') return false;
      const at = getResolvedAt(c);
      return at ? at >= from && at <= to : false;
    });
    const compliant = resolved.filter((c) => !wasResolvedWithSlaBreach(c)).length;
    return {
      ...meta,
      id: reportId,
      generatedAt: new Date().toLocaleString('pt-BR'),
      filters: { period: query.period, channel: query.channel, team: query.team },
      summary: [
        { label: 'SLA médio', value: resolved.length ? `${Math.round((compliant / resolved.length) * 100)}%` : '—' },
        { label: 'Dentro do prazo', value: String(compliant) },
        { label: 'Fora do prazo', value: String(resolved.length - compliant) },
      ],
      columns: ['Fila', 'Canal', 'Equipe', 'SLA', 'Tempo médio'],
      rows,
    };
  }

  if (reportId === 'volume') {
    const dayMap = new Map<string, { in: number; out: number }>();
    chamados.forEach((c) => {
      const created = c.createdAt ? new Date(c.createdAt) : null;
      if (created && created >= from && created <= to) {
        const k = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(created);
        if (!dayMap.has(k)) dayMap.set(k, { in: 0, out: 0 });
        dayMap.get(k)!.in++;
      }
      const resolvedAt = getResolvedAt(c);
      if (resolvedAt && resolvedAt >= from && resolvedAt <= to) {
        const k = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(resolvedAt);
        if (!dayMap.has(k)) dayMap.set(k, { in: 0, out: 0 });
        dayMap.get(k)!.out++;
      }
    });
    const rows = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => [day, String(v.in), String(v.out), String(Math.max(0, v.in - v.out)), '—']);
    const totalIn = [...dayMap.values()].reduce((s, v) => s + v.in, 0);
    const totalOut = [...dayMap.values()].reduce((s, v) => s + v.out, 0);
    return {
      ...meta,
      id: reportId,
      generatedAt: new Date().toLocaleString('pt-BR'),
      filters: { period: query.period, channel: query.channel, team: query.team },
      summary: [
        { label: 'Entradas', value: String(totalIn) },
        { label: 'Resolvidos', value: String(totalOut) },
        { label: 'Backlog', value: String(Math.max(0, totalIn - totalOut)) },
      ],
      columns: ['Dia', 'Entradas', 'Resolvidos', 'Backlog', 'Variação'],
      rows,
    };
  }

  if (reportId === 'team') {
    const lb = buildReportTeamRows(chamados, from, to);
    return {
      ...meta,
      id: reportId,
      generatedAt: new Date().toLocaleString('pt-BR'),
      filters: { period: query.period, channel: query.channel, team: query.team },
      summary: lb.summary,
      columns: ['Agente', 'Resolvidos', 'TMA', 'TME', 'CSAT'],
      rows: lb.rows,
    };
  }

  return null;
}

function buildReportTeamRows(chamados: IChamadoN1[], from: Date, to: Date) {
  const agents = new Map<string, { name: string; resolved: number; tmaSum: number; tmaN: number; tmeSum: number; tmeN: number }>();
  chamados.forEach((c) => {
    const resp = (c.tabulacao?.[c.tabulacao.length - 1]?.responsavel ?? '').trim();
    if (!resp) return;
    const key = resp.toLowerCase();
    if (!agents.has(key)) agents.set(key, { name: resp, resolved: 0, tmaSum: 0, tmaN: 0, tmeSum: 0, tmeN: 0 });
    const row = agents.get(key)!;
    if (currentStatus(c) !== 'resolvido') return;
    const resolvedAt = getResolvedAt(c);
    if (!resolvedAt || resolvedAt < from || resolvedAt > to) return;
    row.resolved++;
    const start = c.createdAt ? new Date(c.createdAt) : resolvedAt;
    row.tmaSum += resolvedAt.getTime() - start.getTime();
    row.tmaN++;
    const firstAgent = getFirstAgentResponseAt(c);
    if (firstAgent) {
      row.tmeSum += firstAgent.getTime() - start.getTime();
      row.tmeN++;
    }
  });
  const rows = [...agents.values()]
    .filter((a) => a.resolved > 0)
    .sort((a, b) => b.resolved - a.resolved)
    .map((a) => [
      a.name,
      String(a.resolved),
      a.tmaN ? formatDurationMs(a.tmaSum / a.tmaN) : '—',
      a.tmeN ? formatDurationMs(a.tmeSum / a.tmeN) : '—',
      '—',
    ]);
  let tmaAll = 0;
  let tmaN = 0;
  let tmeAll = 0;
  let tmeN = 0;
  agents.forEach((a) => {
    if (a.tmaN) { tmaAll += a.tmaSum / a.tmaN; tmaN++; }
    if (a.tmeN) { tmeAll += a.tmeSum / a.tmeN; tmeN++; }
  });
  const totalResolved = rows.reduce((sum, row) => sum + Number(row[1] || 0), 0);
  return {
    summary: [
      { label: 'TMA médio', value: tmaN ? formatDurationMs(tmaAll / tmaN) : '—' },
      { label: 'TME médio', value: tmeN ? formatDurationMs(tmeAll / tmeN) : '—' },
      { label: 'Tickets/agente', value: agents.size ? String((totalResolved / agents.size).toFixed(1)) : '—' },
    ],
    rows,
  };
}

export async function buildReportPayload(authUser: AuthPayload, query: Workspace360Query) {
  const chamados = await loadAllChamados();
  const filtered = chamados.filter((c) => channelMatchesFilter(c, query.channel ?? 'all'));
  const reportId = query.report ?? 'sla';
  return buildReport(reportId, filtered, query);
}
