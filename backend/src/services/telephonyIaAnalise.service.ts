/**
 * telephonyIaAnalise.service — classificação de motivos para ligações Letícia IA (Contact Tel).
 */
import { TelephonyCall, ITelephonyCall } from '../models/TelephonyCall';
import { TelephonyIaAnalise } from '../models/TelephonyIaAnalise';
import { ChamadoIaAnalise } from '../models/ChamadoIaAnalise';
import { env } from '../config/env';
import { hashTextoClassificacao } from './iaTextoHash.util';
import { executarClassificacaoIaLote, type IaClassificacaoCandidato } from './iaClassificacaoBatch.service';
import {
  adaptTelephonyCallToIa,
  buildTelephonyIaText,
  isElegivelTelephonyIaAnalise,
} from './telephonyIaAdapter.service';
import {
  ensureTicketIaSettings,
  getTicketIaExamplesForPrompt,
} from './ticketIaSettings.service';

async function coletarCandidatosTelephony(
  maxCandidatos: number,
  contextoVersao: number,
): Promise<Array<{ call: ITelephonyCall; payload: NonNullable<ReturnType<typeof adaptTelephonyCallToIa>>; textoHash: string }>> {
  const desde = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const calls = await TelephonyCall.find({
    $or: [{ endedAt: { $gte: desde } }, { createdAt: { $gte: desde } }],
    $expr: {
      $gt: [
        {
          $strLenCP: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$summary', ''] },
                  { $ifNull: ['$transcript', ''] },
                ],
              },
            },
          },
        },
        0,
      ],
    },
  })
    .sort({ endedAt: -1, createdAt: -1 })
    .limit(1500)
    .lean<ITelephonyCall[]>();

  const candidatos: Array<{ call: ITelephonyCall; payload: NonNullable<ReturnType<typeof adaptTelephonyCallToIa>>; textoHash: string }> = [];
  const ids: string[] = [];

  for (const call of calls) {
    if (!isElegivelTelephonyIaAnalise(call)) continue;
    const payload = adaptTelephonyCallToIa(call);
    if (!payload) continue;
    const textoHash = hashTextoClassificacao(buildTelephonyIaText(call));
    candidatos.push({ call, payload, textoHash });
    ids.push(String(call._id));
    if (candidatos.length >= 1500) break;
  }

  if (candidatos.length === 0) return [];

  const cacheRows = await TelephonyIaAnalise.find({ telephonyCallId: { $in: ids } })
    .select('telephonyCallId textoHash needsReanalysis contextoVersao origem')
    .lean();
  const cachePorId = new Map(cacheRows.map((r) => [String(r.telephonyCallId), r]));

  return candidatos
    .filter((c) => {
      const row = cachePorId.get(String(c.call._id));
      if (!row) return true;
      if (row.needsReanalysis) return true;
      if (row.origem === 'manual') return false;
      if (row.contextoVersao !== contextoVersao) return true;
      return row.textoHash !== c.textoHash;
    })
    .slice(0, maxCandidatos);
}

async function classificarCandidatosTelephony(
  candidatos: Awaited<ReturnType<typeof coletarCandidatosTelephony>>,
  settings: Awaited<ReturnType<typeof ensureTicketIaSettings>>,
  examples: Awaited<ReturnType<typeof getTicketIaExamplesForPrompt>>,
  recentNewReasons: string[],
): Promise<number> {
  if (candidatos.length === 0) return 0;

  const batchInput: IaClassificacaoCandidato[] = candidatos.map((c) => ({
    itemId: c.payload.telephonyCallId,
    protocolo: c.payload.externalCallId || c.payload.telephonyCallId,
    canal: c.payload.canal,
    abertoEm: c.payload.encerradaEm,
    qualidadeFonte: c.payload.qualidadeFonte,
    textoCliente: c.payload.resumoLigacao,
    textoHash: c.textoHash,
  }));

  const resultados = await executarClassificacaoIaLote(
    batchInput,
    settings,
    examples,
    recentNewReasons,
    'telephony_ia_analise',
  );

  let classificados = 0;
  const porId = new Map(candidatos.map((c) => [c.payload.telephonyCallId, c]));

  for (const item of resultados) {
    const origem = porId.get(item.itemId);
    if (!origem) continue;
    const endedAt = origem.call.endedAt ?? origem.call.createdAt ?? new Date();
    await TelephonyIaAnalise.findOneAndUpdate(
      { telephonyCallId: origem.call._id },
      {
        telephonyCallId: origem.call._id,
        externalCallId: origem.call.externalCallId ?? '',
        callEndedAt: endedAt,
        motivo: item.motivo,
        motivoNovo: item.motivoNovo,
        sentimentoClasse: item.sentimentoClasse,
        casoGrave: item.casoGrave,
        textoHash: item.textoHash,
        qualidadeFonte: item.qualidadeFonte,
        canal: item.canal,
        contextoVersao: settings.contextoVersao,
        modelo: item.modelo,
        origem: 'auto',
        needsReanalysis: false,
        analisadoEm: new Date(),
      },
      { upsert: true, new: true },
    );
    classificados += 1;
  }

  return classificados;
}

export async function runTelephonyIaAnaliseCycle(): Promise<{ candidatos: number; classificados: number }> {
  const settings = await ensureTicketIaSettings();
  const maxCandidates = Math.min(env.chamadoIaAnaliseMaxPerCycle, settings.maxTicketsPorCiclo);
  const [candidatos, examples, recentTicketRows, recentTelephonyRows] = await Promise.all([
    coletarCandidatosTelephony(maxCandidates, settings.contextoVersao),
    getTicketIaExamplesForPrompt(settings.maxExemplosPorMotivo, settings.maxExemplosTotal),
    ChamadoIaAnalise.find({
      motivoNovo: true,
      analisadoEm: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    }).select('motivo').sort({ analisadoEm: -1 }).limit(50).lean(),
    TelephonyIaAnalise.find({
      motivoNovo: true,
      analisadoEm: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    }).select('motivo').sort({ analisadoEm: -1 }).limit(50).lean(),
  ]);

  const recentNewReasons = [
    ...new Set([
      ...recentTicketRows.map((row) => row.motivo),
      ...recentTelephonyRows.map((row) => row.motivo),
    ].filter(Boolean)),
  ].slice(0, 30);

  const classificados = await classificarCandidatosTelephony(candidatos, settings, examples, recentNewReasons);
  return { candidatos: candidatos.length, classificados };
}

/** Classifica uma ligação recém-recebida (fire-and-forget após inbound). */
export async function classificarTelephonyCallPorId(telephonyCallId: string): Promise<boolean> {
  const call = await TelephonyCall.findById(telephonyCallId).lean<ITelephonyCall>();
  if (!call || !isElegivelTelephonyIaAnalise(call)) return false;

  const settings = await ensureTicketIaSettings();
  const payload = adaptTelephonyCallToIa(call);
  if (!payload) return false;

  const textoHash = hashTextoClassificacao(buildTelephonyIaText(call));
  const existing = await TelephonyIaAnalise.findOne({ telephonyCallId: call._id })
    .select('textoHash needsReanalysis contextoVersao origem')
    .lean();

  if (
    existing
    && !existing.needsReanalysis
    && existing.origem === 'auto'
    && existing.contextoVersao === settings.contextoVersao
    && existing.textoHash === textoHash
  ) {
    return false;
  }

  const examples = await getTicketIaExamplesForPrompt(settings.maxExemplosPorMotivo, settings.maxExemplosTotal);
  const classificados = await classificarCandidatosTelephony(
    [{ call, payload, textoHash }],
    settings,
    examples,
    [],
  );
  return classificados > 0;
}
