/**
 * iaResumo.service — resumo diário de análise IA (tickets + ligações Letícia IA).
 */
import { ChamadoN1, IChamadoN1 } from '../../models/ChamadoN1';
import { ChamadoIaAnalise } from '../../models/ChamadoIaAnalise';
import { TelephonyCall, ITelephonyCall } from '../../models/TelephonyCall';
import { TelephonyIaAnalise } from '../../models/TelephonyIaAnalise';
import { currentStatus } from '../chamado.mapper';
import { isElegivelParaAnaliseIa } from '../chamadoIaAnalise.service';
import { isElegivelTelephonyIaAnalise } from '../telephonyIaAdapter.service';
import { adaptChamadoToTicketIa } from '../ticketIaAdapter.service';
import { brasiliaDayBoundsUtc } from './dates/brasilDay';

export type MotivoIA = {
  motivo: string;
  tickets: number;
  pct: number;
  novo: boolean;
};

export type AnaliseIaResumoDia = {
  ticketsDoDia: number;
  candidatosComTexto: number;
  baseClassificada: number;
  /** @deprecated use motivosGeral — mantido por compatibilidade */
  motivos: MotivoIA[];
  motivosTickets: MotivoIA[];
  motivosLeticia: MotivoIA[];
  motivosGeral: MotivoIA[];
  telefoneHumanoComNota: number;
  telefoneHumanoTotal: number;
  ligacoesLeticiaDoDia: number;
  ligacoesLeticiaClassificadas: number;
  ultimaAtualizacaoIa: string | null;
};

function isTelefoneCanal(canal: string): boolean {
  const c = canal.toLowerCase();
  return c.includes('telefon') || c === 'telephony';
}

function isLeticiaIa(canal: string): boolean {
  const c = canal.toLowerCase();
  return c.includes('leticia') || c.includes('ia-telefon');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function hasAgentNote(chamado: IChamadoN1): boolean {
  return (chamado.registro ?? []).some(
    (reg) => reg.origin === 'agente' && String(reg.mensagemPublica ?? '').trim(),
  );
}

function mergeMotivo(
  map: Map<string, { tickets: number; novo: boolean }>,
  motivo: string,
  motivoNovo: boolean,
) {
  const prev = map.get(motivo);
  map.set(motivo, {
    tickets: (prev?.tickets ?? 0) + 1,
    novo: prev?.novo || motivoNovo,
  });
}

function trackUltimaAtualizacao(iso: string | null | undefined, current: string | null): string | null {
  if (!iso) return current;
  return !current || iso > current ? iso : current;
}

export async function getIaResumoDia(todayStr: string, topN = 6): Promise<AnaliseIaResumoDia> {
  const { startIso, endIso } = brasiliaDayBoundsUtc(todayStr);
  const dayStart = new Date(startIso);
  const dayEnd = new Date(endIso);

  const [chamados, ligacoes] = await Promise.all([
    ChamadoN1.find({
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select('createdAt registro tabulacao chamadoTitulo chamadoProtocolo')
      .lean<IChamadoN1[]>(),
    TelephonyCall.find({
      $or: [
        { endedAt: { $gte: dayStart, $lte: dayEnd } },
        { createdAt: { $gte: dayStart, $lte: dayEnd } },
      ],
    })
      .select('summary transcript endedAt createdAt')
      .lean<ITelephonyCall[]>(),
  ]);

  const ticketsDoDiaIds: string[] = [];
  const ligacoesDoDiaIds: string[] = [];
  let candidatosComTexto = 0;
  let telefoneHumanoComNota = 0;
  let telefoneHumanoTotal = 0;
  let ligacoesLeticiaDoDia = 0;

  for (const chamado of chamados) {
    if (currentStatus(chamado) === 'cancelado') continue;

    const id = String((chamado as unknown as { _id: unknown })._id);
    ticketsDoDiaIds.push(id);

    const payload = adaptChamadoToTicketIa(chamado);
    const canal = payload?.canal ?? 'velodesk';
    if (isTelefoneCanal(canal) && !isLeticiaIa(canal)) {
      telefoneHumanoTotal += 1;
      if (hasAgentNote(chamado)) telefoneHumanoComNota += 1;
    }

    if (isElegivelParaAnaliseIa(chamado)) candidatosComTexto += 1;
  }

  for (const call of ligacoes) {
    if (!isElegivelTelephonyIaAnalise(call)) continue;
    ligacoesLeticiaDoDia += 1;
    ligacoesDoDiaIds.push(String(call._id));
    candidatosComTexto += 1;
  }

  const motivosTicketsMap = new Map<string, { tickets: number; novo: boolean }>();
  const motivosLeticiaMap = new Map<string, { tickets: number; novo: boolean }>();
  let baseClassificadaTickets = 0;
  let ligacoesLeticiaClassificadas = 0;
  let ultimaAtualizacaoIa: string | null = null;

  for (const grupo of chunk(ticketsDoDiaIds, 250)) {
    if (!grupo.length) continue;
    const analyses = await ChamadoIaAnalise.find({ chamadoId: { $in: grupo } })
      .select('chamadoId motivo motivoNovo needsReanalysis analisadoEm')
      .lean();

    for (const row of analyses) {
      if (row.needsReanalysis) continue;
      baseClassificadaTickets += 1;
      mergeMotivo(motivosTicketsMap, row.motivo, row.motivoNovo);
      ultimaAtualizacaoIa = trackUltimaAtualizacao(
        row.analisadoEm ? new Date(row.analisadoEm).toISOString() : null,
        ultimaAtualizacaoIa,
      );
    }
  }

  for (const grupo of chunk(ligacoesDoDiaIds, 250)) {
    if (!grupo.length) continue;
    const analyses = await TelephonyIaAnalise.find({ telephonyCallId: { $in: grupo } })
      .select('telephonyCallId motivo motivoNovo needsReanalysis analisadoEm')
      .lean();

    for (const row of analyses) {
      if (row.needsReanalysis) continue;
      ligacoesLeticiaClassificadas += 1;
      mergeMotivo(motivosLeticiaMap, row.motivo, row.motivoNovo);
      ultimaAtualizacaoIa = trackUltimaAtualizacao(
        row.analisadoEm ? new Date(row.analisadoEm).toISOString() : null,
        ultimaAtualizacaoIa,
      );
    }
  }

  const baseClassificada = baseClassificadaTickets + ligacoesLeticiaClassificadas;

  function toRanking(map: Map<string, { tickets: number; novo: boolean }>, base: number): MotivoIA[] {
    return Array.from(map.entries())
      .map(([motivo, { tickets, novo }]) => ({
        motivo,
        tickets,
        pct: base > 0 ? Math.round((tickets / base) * 1000) / 10 : 0,
        novo,
      }))
      .sort((a, b) => b.tickets - a.tickets)
      .slice(0, topN);
  }

  const motivosTickets = toRanking(motivosTicketsMap, baseClassificadaTickets);
  const motivosLeticia = toRanking(motivosLeticiaMap, ligacoesLeticiaClassificadas);

  const motivosGeralMap = new Map<string, { tickets: number; novo: boolean }>();
  for (const [motivo, { tickets, novo }] of motivosTicketsMap.entries()) {
    motivosGeralMap.set(motivo, { tickets, novo });
  }
  for (const [motivo, { tickets: leticiaTickets, novo }] of motivosLeticiaMap.entries()) {
    const prev = motivosGeralMap.get(motivo);
    motivosGeralMap.set(motivo, {
      tickets: (prev?.tickets ?? 0) + leticiaTickets,
      novo: prev?.novo || novo,
    });
  }
  const motivosGeral = toRanking(motivosGeralMap, baseClassificada);

  return {
    ticketsDoDia: ticketsDoDiaIds.length,
    candidatosComTexto,
    baseClassificada,
    motivos: motivosGeral,
    motivosTickets,
    motivosLeticia,
    motivosGeral,
    telefoneHumanoComNota,
    telefoneHumanoTotal,
    ligacoesLeticiaDoDia,
    ligacoesLeticiaClassificadas,
    ultimaAtualizacaoIa,
  };
}
