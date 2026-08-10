/**
 * ticketMetrics.service — métricas de tickets do dia via Mongo (ChamadoN1), substituindo Octadesk no Realtime.
 */
import { ChamadoN1, IChamadoN1 } from '../../models/ChamadoN1';
import { currentStatus } from '../chamado.mapper';
import { adaptChamadoToTicketIa } from '../ticketIaAdapter.service';
import { brasiliaDayBoundsUtc } from './dates/brasilDay';
import type { BreakdownItem, TicketMetrics } from './telao/metrics';

const OPEN_STATUSES = ['novo', 'em-andamento', 'pendente'];
const TERMINAL_RESOLVED = new Set(['resolvido', 'fechado']);

function mapStatus(status: string): keyof Pick<TicketMetrics, 'novo' | 'andamento' | 'pendente' | 'resolvido' | 'cancelado'> | null {
  const s = status.toLowerCase();
  if (s === 'novo') return 'novo';
  if (s === 'em-andamento') return 'andamento';
  if (s === 'pendente') return 'pendente';
  if (TERMINAL_RESOLVED.has(s)) return 'resolvido';
  if (s === 'cancelado') return 'cancelado';
  return null;
}

function displayCanalLabel(canal: string): string {
  const c = canal.toLowerCase();
  if (c.includes('telefon') || c === 'telephony') return 'Telefone';
  if (c.includes('email')) return 'E-mail';
  if (c.includes('whatsapp')) return 'WhatsApp';
  if (c.includes('app')) return 'App';
  if (c.includes('form')) return 'Formulário';
  if (c.includes('bot')) return 'Bot';
  if (c.includes('leticia') || c.includes('ia')) return 'Letícia IA';
  return canal ? canal.charAt(0).toUpperCase() + canal.slice(1) : 'Velodesk';
}

function countByCanal(labels: string[]): BreakdownItem[] {
  const map = new Map<string, number>();
  for (const label of labels) map.set(label, (map.get(label) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: String(value) }));
}

function averageMinutesByCanal(rows: Array<{ label: string; minutes: number }>): BreakdownItem[] {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (!map.has(row.label)) map.set(row.label, []);
    map.get(row.label)!.push(row.minutes);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, values]) => ({
      label,
      value: `${Math.round(values.reduce((a, b) => a + b, 0) / values.length)}m`,
    }));
}

function getResolvedAt(chamado: IChamadoN1): Date | null {
  const regs = chamado.registro ?? [];
  for (let i = regs.length - 1; i >= 0; i--) {
    if (TERMINAL_RESOLVED.has(regs[i].status) || regs[i].status === 'cancelado') {
      return new Date(regs[i].data);
    }
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

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function getTicketMetricsForDay(todayStr: string): Promise<TicketMetrics> {
  const { startIso, endIso } = brasiliaDayBoundsUtc(todayStr);

  const chamados = await ChamadoN1.find({
    createdAt: { $gte: new Date(startIso), $lte: new Date(endIso) },
  })
    .select('createdAt registro tabulacao chamadoTitulo')
    .lean<IChamadoN1[]>();

  let novo = 0;
  let andamento = 0;
  let pendente = 0;
  let resolvido = 0;
  let cancelado = 0;
  const novoLabels: string[] = [];
  const resolvedMinutes: number[] = [];
  const resolvedMinutesByCanal: Array<{ label: string; minutes: number }> = [];
  const primeiraRespostaMinutos: number[] = [];
  let totalNonCancelado = 0;

  for (const chamado of chamados) {
    const status = currentStatus(chamado);
    const bucket = mapStatus(status);
    if (status !== 'cancelado') totalNonCancelado += 1;

    const payload = adaptChamadoToTicketIa(chamado);
    const canalLabel = displayCanalLabel(payload?.canal ?? 'velodesk');

    if (bucket === 'novo') {
      novo += 1;
      novoLabels.push(canalLabel);
    } else if (bucket === 'andamento') andamento += 1;
    else if (bucket === 'pendente') pendente += 1;
    else if (bucket === 'resolvido') resolvido += 1;
    else if (bucket === 'cancelado') cancelado += 1;

    if (bucket === 'resolvido') {
      const resolvedAt = getResolvedAt(chamado);
      const createdAt = chamado.createdAt ? new Date(chamado.createdAt) : null;
      if (resolvedAt && createdAt) {
        const minutes = (resolvedAt.getTime() - createdAt.getTime()) / 60000;
        if (Number.isFinite(minutes) && minutes > 0 && minutes < 10080) {
          resolvedMinutes.push(minutes);
          resolvedMinutesByCanal.push({ label: canalLabel, minutes });
        }
      }
    }

    const firstResponseAt = getFirstAgentResponseAt(chamado);
    const createdAt = chamado.createdAt ? new Date(chamado.createdAt) : null;
    if (firstResponseAt && createdAt) {
      const minutes = (firstResponseAt.getTime() - createdAt.getTime()) / 60000;
      if (Number.isFinite(minutes) && minutes > 0) primeiraRespostaMinutos.push(minutes);
    }
  }

  const totalATratar = await ChamadoN1.countDocuments({
    $expr: {
      $in: [{ $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'] }, OPEN_STATUSES],
    },
  });

  return {
    total: totalNonCancelado,
    novo,
    andamento,
    pendente,
    resolvido,
    cancelado,
    tmaMin: resolvedMinutes.length
      ? Math.round(resolvedMinutes.reduce((a, b) => a + b, 0) / resolvedMinutes.length)
      : null,
    satisfacao: null,
    satisfacaoLabel: 'Velodesk · indisponível',
    novoPorCanal: countByCanal(novoLabels),
    totalATratar,
    totalATratarIndisponivel: false,
    tmaUteisMin: average(resolvedMinutes),
    tmaUteisPorCanal: averageMinutesByCanal(resolvedMinutesByCanal),
    primeiraRespostaUteisMin: average(primeiraRespostaMinutos),
    ultimaAtualizacaoTempos: null,
  };
}
