/**
 * chamadoIaAnalise.service v1.0.0 — classificação de IA do texto real do cliente por ticket
 * VERSION: v1.0.0 | DATE: 2026-07-23
 *
 * Adaptado da técnica usada no projeto wfm_atendimento (análise de IA do Octadesk): lê
 * título + mensagens do CLIENTE (não a tabulação feita pelo atendente) e classifica cada
 * ticket via OpenAI Responses API (Structured Outputs). MVP focado em alerta precoce de
 * "caso grave" — menção a Bacen/Procon/Reclame Aqui/ação judicial/órgão regulador dentro de
 * um ticket comum, ainda não escalonado formalmente. motivo/sentimentoClasse já saem da
 * mesma chamada (sem custo adicional) para uso futuro em cards complementares.
 *
 * Cache por hash de conteúdo (textoHash): evita reclassificar um ticket cujo texto do
 * cliente não mudou, mesmo que status/tags tenham sido atualizados depois.
 */
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import { ChamadoN1, IChamadoN1 } from '../models/ChamadoN1';
import { ChamadoIaAnalise, ICasoGraveIA, SentimentoClasseIA } from '../models/ChamadoIaAnalise';
import { TicketIaExemplo } from '../models/TicketIaExemplo';
import type { ITicketIaSettings } from '../models/TicketIaSettings';
import { currentStatus, GESTAO_TERMINAL_STATUSES } from './chamado.mapper';
import { env } from '../config/env';
import {
  createOpenAiClient,
  extractOutputText,
  mapOpenAiErrorMessage,
  parseAiJson,
} from './agents/openaiAgent.util';
import { logAiUsage } from './aiUsage.service';
import {
  adaptChamadoToTicketIa,
  buildTicketIaText,
  resolveFormalCaseSource,
  TicketIaPayload,
} from './ticketIaAdapter.service';
import {
  canonicalizeTicketIaReason,
  ensureTicketIaSettings,
  getTicketIaExamplesForPrompt,
  normalizeForComparison,
  resolveTicketIaAlias,
  TicketIaExamplePrompt,
  updateTicketIaSettings,
} from './ticketIaSettings.service';
import { resolvePeriodRange, GestaoInsightsQuery } from './gestaoInsights.service';

const LOTE_SIZE = 40;
const MAX_TEXTO_CLIENTE = 4000;
const SENTIMENTOS_VALIDOS: SentimentoClasseIA[] = ['positivo', 'neutro', 'irritado', 'confuso', 'critico'];

export interface CandidatoIaAnalise {
  chamado: IChamadoN1;
  payload: TicketIaPayload;
  textoCliente: string;
  textoHash: string;
}

interface ClassificacaoItem {
  chamadoId: string;
  motivo: string;
  motivoNovo: boolean;
  sentimentoClasse: string;
  casoGrave: { tipo: string; trecho: string } | null;
}

/** Elegível quando há relato analisável e o ticket ainda não pertence a um canal especial formal. */
export function isElegivelParaAnaliseIa(chamado: IChamadoN1): boolean {
  const payload = adaptChamadoToTicketIa(chamado);
  return Boolean(payload && !payload.formalCaseSource && buildTicketIaText(payload).length > 0);
}

export function hashTextoClassificacao(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}

const CLASSIFICACAO_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    classificacoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chamadoId: { type: 'string' },
          motivo: { type: 'string' },
          motivoNovo: { type: 'boolean' },
          sentimentoClasse: { type: 'string', enum: SENTIMENTOS_VALIDOS },
          casoGrave: {
            type: ['object', 'null'],
            properties: {
              tipo: { type: 'string' },
              trecho: { type: 'string' },
            },
            required: ['tipo', 'trecho'],
            additionalProperties: false,
          },
        },
        required: ['chamadoId', 'motivo', 'motivoNovo', 'sentimentoClasse', 'casoGrave'],
      },
    },
  },
  required: ['classificacoes'],
} as const;

function buildSystemPrompt(
  settings: ITicketIaSettings,
  examples: TicketIaExamplePrompt[],
  recentNewReasons: string[],
): string {
  const blocks = ['Você é um analista sênior de atendimento de uma fintech de crédito.'];
  if (settings.contextoEmpresa) blocks.push(`Contexto da empresa:\n${settings.contextoEmpresa}`);
  if (settings.instrucoesOutros) {
    blocks.push(`Regras de desambiguação antes de usar "Outros":\n${settings.instrucoesOutros}`);
  }
  if (settings.taxonomiaMotivos.length) {
    blocks.push(
      `Taxonomia oficial. Prefira SEMPRE um destes rótulos e copie o texto exatamente:\n${
        settings.taxonomiaMotivos.map((item) => `- ${item}`).join('\n')
      }`,
    );
  }
  if (settings.motivoAliases.length) {
    blocks.push(
      `Sinônimos já confirmados. Quando identificar o rótulo à esquerda, use o da direita:\n${
        settings.motivoAliases.map((alias) => `- "${alias.de}" → "${alias.para}"`).join('\n')
      }`,
    );
  }
  if (examples.length) {
    blocks.push(
      `Exemplos reais corrigidos por gestores (aprenda o contexto, não copie dados pessoais):\n${
        examples.map((example) =>
          `- Título: ${example.titulo || '(sem título)'} | Trecho: ${example.trecho} | Motivo confirmado: ${example.motivo}`
        ).join('\n')
      }`,
    );
  }
  if (recentNewReasons.length) {
    blocks.push(
      `Motivos novos usados nos últimos 30 dias. Reutilize o mesmo texto quando o assunto for equivalente:\n${
        recentNewReasons.map((item) => `- ${item}`).join('\n')
      }`,
    );
  }
  blocks.push(`Tarefa: leia o TÍTULO e o RELATO DO CLIENTE de cada ticket. Não use a tabulação manual como resposta. Quando a fonte estiver marcada como "resumo transcrito", trate-a como descrição do atendente, não como citação literal.

Responda SOMENTE com JSON válido, com uma "classificacoes" (array), um item por ticket:
{ "chamadoId": "<id>", "motivo": "<rótulo curto>", "motivoNovo": true|false, "sentimentoClasse": "positivo|neutro|irritado|confuso|critico", "casoGrave": { "tipo": "Bacen|Procon|Reclame Aqui|Ação judicial|Órgão regulador|Outro", "trecho": "<trecho real>" } | null }

Regras:
- Use motivoNovo=false quando o motivo pertence à taxonomia ou à lista de motivos recentes.
- Só crie motivo novo quando nenhum rótulo conhecido servir e existir um padrão específico.
- "Outros" é apenas para conteúdo realmente ambíguo.
- casoGrave exige menção real e explícita do cliente; resumos transcritos sem citação literal não devem produzir trecho entre aspas.
- Devolva exatamente um item por ticket recebido. Não invente dados. Escreva em português do Brasil.`);
  return blocks.join('\n\n');
}

function buildUserPrompt(candidatos: CandidatoIaAnalise[]): string {
  const payload = candidatos.map((c) => ({
    chamadoId: c.payload.chamadoId,
    protocolo: c.payload.protocolo,
    canal: c.payload.canal,
    abertoEm: c.payload.abertoEm,
    qualidadeFonte: c.payload.qualidadeFonte,
    texto: c.textoCliente,
  }));
  return `Total de tickets a classificar nesta chamada: ${candidatos.length}.

Tickets (JSON):
${JSON.stringify(payload, null, 2)}

Responda apenas com o objeto JSON no formato pedido, com um item por ticket.`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Busca candidatos elegíveis e ainda sem cache válido (hash do texto do cliente mudou ou nunca foi analisado). */
async function coletarCandidatos(
  maxCandidatos: number,
  contextoVersao: number,
): Promise<CandidatoIaAnalise[]> {
  // Universo: tickets ativos (não terminais) OU resolvidos/fechados/cancelados recentemente
  // (últimos 14 dias) — cobre o caso de um ticket já fechado sem a menção ter sido notada.
  const desde = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const chamados = await ChamadoN1.find({
    $or: [
      { $expr: { $not: [{ $in: [{ $arrayElemAt: ['$registro.status', -1] }, [...GESTAO_TERMINAL_STATUSES]] }] } },
      { updatedAt: { $gte: desde } },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(2000)
    .exec();

  const candidatos: CandidatoIaAnalise[] = [];
  const idsElegiveis: string[] = [];
  for (const chamado of chamados) {
    const payload = adaptChamadoToTicketIa(chamado);
    if (!payload || payload.formalCaseSource) continue;
    const textoCliente = buildTicketIaText(payload, MAX_TEXTO_CLIENTE);
    if (!textoCliente) continue;
    candidatos.push({
      chamado,
      payload,
      textoCliente,
      textoHash: hashTextoClassificacao(textoCliente),
    });
    idsElegiveis.push(String(chamado._id));
    if (candidatos.length >= 2000) break;
  }
  if (candidatos.length === 0) return [];

  const cacheRows = await ChamadoIaAnalise.find({ chamadoId: { $in: idsElegiveis } })
    .select('chamadoId textoHash needsReanalysis contextoVersao origem')
    .lean();
  const cachePorId = new Map(cacheRows.map((r) => [String(r.chamadoId), r]));

  const precisaClassificar = candidatos.filter((c) => {
    const row = cachePorId.get(String(c.chamado._id));
    if (!row) return true;
    if (row.needsReanalysis) return true;
    if (row.origem === 'manual') return false;
    if (row.contextoVersao !== contextoVersao) return true;
    return row.textoHash !== c.textoHash;
  });

  return precisaClassificar.slice(0, maxCandidatos);
}

/** Classifica um lote de candidatos via OpenAI Responses API e persiste no cache. Retorna quantos foram classificados. */
async function classificarLote(
  candidatos: CandidatoIaAnalise[],
  settings: ITicketIaSettings,
  examples: TicketIaExamplePrompt[],
  recentNewReasons: string[],
): Promise<number> {
  if (candidatos.length === 0) return 0;
  const openai = createOpenAiClient();
  let classificadosTotal = 0;

  for (const lote of chunk(candidatos, LOTE_SIZE)) {
    try {
      const response = await openai.responses.create({
        model: env.chamadoIaAnaliseModel,
        input: [
          { role: 'system', content: buildSystemPrompt(settings, examples, recentNewReasons) },
          { role: 'user', content: buildUserPrompt(lote) },
        ],
        reasoning: { effort: 'low' },
        text: {
          format: {
            type: 'json_schema',
            name: 'classificacao_chamados_ia',
            schema: CLASSIFICACAO_JSON_SCHEMA,
            strict: true,
          },
        },
      });

      if (response.usage) {
        void logAiUsage({
          provider: 'openai',
          model: response.model || env.chamadoIaAnaliseModel,
          feature: 'chamado_ia_analise',
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        });
      }

      const raw = extractOutputText(response);
      const parsed = parseAiJson<{ classificacoes?: ClassificacaoItem[] }>(raw);
      const classificacoes = parsed?.classificacoes ?? [];
      const porId = new Map(lote.map((c) => [String(c.chamado._id), c]));

      const upserts = classificacoes
        .map((item) => {
          const candidato = porId.get(String(item.chamadoId));
          if (!candidato) return null;
          const sentimentoClasse = SENTIMENTOS_VALIDOS.includes(item.sentimentoClasse as SentimentoClasseIA)
            ? item.sentimentoClasse
            : 'neutro';
          const casoGrave: ICasoGraveIA | null =
            item.casoGrave && String(item.casoGrave.tipo ?? '').trim()
              ? { tipo: String(item.casoGrave.tipo).trim(), trecho: String(item.casoGrave.trecho ?? '').trim() }
              : null;
          const motivoBruto = String(item.motivo ?? '').trim() || 'Outros';
          const motivoAliasado = resolveTicketIaAlias(motivoBruto, settings.motivoAliases) ?? motivoBruto;
          const motivo = canonicalizeTicketIaReason(motivoAliasado, settings.taxonomiaMotivos);
          const conhecido = settings.taxonomiaMotivos.includes(motivo);
          return {
            chamadoId: candidato.chamado._id,
            chamadoProtocolo: candidato.chamado.chamadoProtocolo || '',
            ticketCreatedAt: candidato.chamado.createdAt ?? new Date(),
            motivo,
            motivoNovo: Boolean(item.motivoNovo) && !conhecido,
            sentimentoClasse,
            casoGrave,
            textoHash: candidato.textoHash,
            qualidadeFonte: candidato.payload.qualidadeFonte,
            canal: candidato.payload.canal,
            contextoVersao: settings.contextoVersao,
            modelo: response.model || env.chamadoIaAnaliseModel,
            origem: 'auto' as const,
            needsReanalysis: false,
            analisadoEm: new Date(),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v != null);

      for (const doc of upserts) {
        await ChamadoIaAnalise.findOneAndUpdate({ chamadoId: doc.chamadoId }, doc, { upsert: true, new: true });
      }
      classificadosTotal += upserts.length;
    } catch (err) {
      console.warn('[chamado-ia-analise] lote falhou:', mapOpenAiErrorMessage(err));
    }
  }

  return classificadosTotal;
}

export async function runChamadoIaAnaliseCycle(): Promise<{ candidatos: number; classificados: number }> {
  const settings = await ensureTicketIaSettings();
  const maxCandidates = Math.min(env.chamadoIaAnaliseMaxPerCycle, settings.maxTicketsPorCiclo);
  const [candidatos, examples, recentRows] = await Promise.all([
    coletarCandidatos(maxCandidates, settings.contextoVersao),
    getTicketIaExamplesForPrompt(settings.maxExemplosPorMotivo, settings.maxExemplosTotal),
    ChamadoIaAnalise.find({
      motivoNovo: true,
      analisadoEm: { $gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
    }).select('motivo').sort({ analisadoEm: -1 }).limit(100).lean(),
  ]);
  const recentNewReasons = [...new Set(recentRows.map((row) => row.motivo).filter(Boolean))].slice(0, 30);
  const classificados = await classificarLote(candidatos, settings, examples, recentNewReasons);
  return { candidatos: candidatos.length, classificados };
}

export async function runChamadoIaBackfill(options: {
  max?: number;
  dryRun?: boolean;
} = {}): Promise<{
  candidatos: number;
  classificados: number;
  preview: Array<{ chamadoId: string; protocolo: string; qualidadeFonte: string }>;
}> {
  const settings = await ensureTicketIaSettings();
  const max = Math.min(100, Math.max(1, options.max ?? 10));
  const [candidatos, examples] = await Promise.all([
    coletarCandidatos(max, settings.contextoVersao),
    getTicketIaExamplesForPrompt(settings.maxExemplosPorMotivo, settings.maxExemplosTotal),
  ]);
  const preview = candidatos.map((item) => ({
    chamadoId: item.payload.chamadoId,
    protocolo: item.payload.protocolo,
    qualidadeFonte: item.payload.qualidadeFonte,
  }));
  if (options.dryRun !== false) {
    return { candidatos: candidatos.length, classificados: 0, preview };
  }
  const classificados = await classificarLote(candidatos, settings, examples, []);
  return { candidatos: candidatos.length, classificados, preview };
}

export interface RiscoCasoEspecialItem {
  id: string;
  protocolo: string;
  titulo: string;
  tipo: string;
  trecho: string;
  status: string;
  ageDays: number;
  analisadoEm: string;
}

/** Tickets ativos (não resolvidos/cancelados/fechados) com menção real a caso grave, ainda não escalonados formalmente. */
export async function getRiscosCasoEspecial(limit = 10): Promise<RiscoCasoEspecialItem[]> {
  const analises = await ChamadoIaAnalise.find({ 'casoGrave.tipo': { $exists: true, $ne: null } })
    .sort({ analisadoEm: -1 })
    .limit(500)
    .populate<{ chamadoId: IChamadoN1 }>('chamadoId')
    .lean();

  const terminais = new Set<string>([...GESTAO_TERMINAL_STATUSES]);
  const itens: RiscoCasoEspecialItem[] = [];

  for (const analise of analises) {
    const chamado = analise.chamadoId as unknown as IChamadoN1 | null;
    if (!chamado || !chamado.registro) continue;
    const status = currentStatus(chamado);
    if (terminais.has(status)) continue;
    if (resolveFormalCaseSource(chamado)) continue;

    const createdAt = (chamado as unknown as { createdAt?: Date }).createdAt ?? new Date();
    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 3600 * 1000)));

    itens.push({
      id: String(chamado._id),
      protocolo: chamado.chamadoProtocolo || '',
      titulo: chamado.chamadoTitulo || '',
      tipo: analise.casoGrave?.tipo ?? 'Outro',
      trecho: analise.casoGrave?.trecho ?? '',
      status,
      ageDays,
      analisadoEm: new Date(analise.analisadoEm).toISOString(),
    });
    if (itens.length >= limit) break;
  }

  return itens;
}

export async function markChamadoIaForReanalysis(chamadoId: string): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(chamadoId)) return;
  await ChamadoIaAnalise.updateOne(
    { chamadoId },
    { $set: { needsReanalysis: true, origem: 'auto' }, $unset: { corrigidoPor: 1, corrigidoEm: 1 } },
  );
}

export async function markChamadosIaForReanalysis(chamadoIds: string[]): Promise<void> {
  const validIds = chamadoIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return;
  await ChamadoIaAnalise.updateMany(
    { chamadoId: { $in: validIds } },
    { $set: { needsReanalysis: true, origem: 'auto' }, $unset: { corrigidoPor: 1, corrigidoEm: 1 } },
  );
}

export async function correctChamadoIaReason(params: {
  chamadoIds: string[];
  motivo: string;
  userId?: string;
  promoteTaxonomy?: boolean;
  createAliasFrom?: string;
}): Promise<{ updated: number; motivo: string }> {
  const chamadoIds = params.chamadoIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const motivo = String(params.motivo ?? '').trim();
  if (!chamadoIds.length || !motivo) throw new Error('Informe tickets e motivo válidos.');

  let settings = await ensureTicketIaSettings();
  const taxonomy = settings.taxonomiaMotivos;
  const shouldPromote = params.promoteTaxonomy
    && !taxonomy.some((item) => normalizeForComparison(item) === normalizeForComparison(motivo));
  const aliases = [...settings.motivoAliases];
  const aliasFrom = String(params.createAliasFrom ?? '').trim();
  if (
    aliasFrom
    && !['outros', 'outro'].includes(normalizeForComparison(aliasFrom))
    && !aliases.some((item) => normalizeForComparison(item.de) === normalizeForComparison(aliasFrom))
  ) {
    aliases.push({ de: aliasFrom, para: motivo });
  }
  if (shouldPromote || aliases.length !== settings.motivoAliases.length) {
    settings = await updateTicketIaSettings({
      taxonomiaMotivos: shouldPromote ? [...taxonomy, motivo] : taxonomy,
      motivoAliases: aliases,
    }, params.userId);
  }

  const chamados = await ChamadoN1.find({ _id: { $in: chamadoIds } });
  let updated = 0;
  for (const chamado of chamados) {
    const payload = adaptChamadoToTicketIa(chamado);
    if (!payload) continue;
    const text = buildTicketIaText(payload, MAX_TEXTO_CLIENTE);
    const existing = await ChamadoIaAnalise.findOne({ chamadoId: chamado._id });
    await ChamadoIaAnalise.findOneAndUpdate(
      { chamadoId: chamado._id },
      {
        chamadoId: chamado._id,
        chamadoProtocolo: chamado.chamadoProtocolo || '',
        ticketCreatedAt: chamado.createdAt ?? new Date(),
        motivo,
        motivoNovo: false,
        sentimentoClasse: existing?.sentimentoClasse ?? 'neutro',
        casoGrave: existing?.casoGrave ?? null,
        textoHash: hashTextoClassificacao(text),
        qualidadeFonte: payload.qualidadeFonte,
        canal: payload.canal,
        contextoVersao: settings.contextoVersao,
        modelo: 'manual',
        origem: 'manual',
        needsReanalysis: false,
        corrigidoPor: params.userId,
        corrigidoEm: new Date(),
        analisadoEm: new Date(),
      },
      { upsert: true, new: true },
    );
    await TicketIaExemplo.findOneAndUpdate(
      { chamadoId: chamado._id, motivo },
      {
        chamadoId: chamado._id,
        protocolo: chamado.chamadoProtocolo,
        titulo: payload.titulo,
        trecho: payload.descricaoCliente.slice(0, 2000),
        motivo,
        confirmadoPor: params.userId,
        ativo: true,
      },
      { upsert: true, new: true },
    );
    updated += 1;
  }
  return { updated, motivo };
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

export async function getCustomerVoiceInsights(query: GestaoInsightsQuery = {}) {
  const range = resolvePeriodRange(query);
  const chamados = await ChamadoN1.find({
    createdAt: { $gte: range.start, $lte: range.end },
  }).select('chamadoProtocolo chamadoTitulo createdAt tabulacao registro').lean();

  const eligible = chamados
    .map((chamado) => ({ chamado, payload: adaptChamadoToTicketIa(chamado as unknown as IChamadoN1) }))
    .filter((entry) => entry.payload && !entry.payload.formalCaseSource);
  const ids = eligible.map((entry) => String(entry.chamado._id));
  const analyses = ids.length
    ? await ChamadoIaAnalise.find({ chamadoId: { $in: ids } }).lean()
    : [];
  const byId = new Map(analyses.map((analysis) => [String(analysis.chamadoId), analysis]));
  const reasonMap = new Map<string, number>();
  const sentimentMap = new Map<string, number>();
  let divergences = 0;
  let directSource = 0;

  for (const { chamado, payload } of eligible) {
    if (payload?.qualidadeFonte === 'direto_cliente') directSource += 1;
    const analysis = byId.get(String(chamado._id));
    if (!analysis) continue;
    reasonMap.set(analysis.motivo, (reasonMap.get(analysis.motivo) ?? 0) + 1);
    sentimentMap.set(
      analysis.sentimentoClasse,
      (sentimentMap.get(analysis.sentimentoClasse) ?? 0) + 1,
    );
    const manualReason = String(chamado.tabulacao?.[chamado.tabulacao.length - 1]?.motivo ?? '').trim();
    if (
      manualReason
      && normalizeForComparison(manualReason) !== normalizeForComparison(analysis.motivo)
    ) {
      divergences += 1;
    }
  }

  const analyzed = analyses.length;
  return {
    range: { start: range.start.toISOString(), end: range.end.toISOString() },
    coverage: {
      eligible: eligible.length,
      analyzed,
      pending: Math.max(0, eligible.length - analyzed),
      directSource,
      transcribedSource: Math.max(0, eligible.length - directSource),
      pct: pct(analyzed, eligible.length),
    },
    reasons: [...reasonMap.entries()]
      .map(([motivo, count]) => ({ motivo, count, pct: pct(count, analyzed) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    sentiments: [...sentimentMap.entries()]
      .map(([sentimento, count]) => ({ sentimento, count, pct: pct(count, analyzed) }))
      .sort((a, b) => b.count - a.count),
    divergence: { count: divergences, pct: pct(divergences, analyzed) },
  };
}

export async function getCustomerVoiceTickets(params: {
  query?: GestaoInsightsQuery;
  motivo?: string;
  sentimento?: string;
  limit?: number;
}) {
  const range = resolvePeriodRange(params.query ?? {});
  const filter: Record<string, unknown> = {
    ticketCreatedAt: { $gte: range.start, $lte: range.end },
  };
  if (params.motivo) filter.motivo = params.motivo;
  if (params.sentimento) filter.sentimentoClasse = params.sentimento;
  const rows = await ChamadoIaAnalise.find(filter)
    .sort({ ticketCreatedAt: -1 })
    .limit(Math.min(200, Math.max(1, params.limit ?? 100)))
    .populate<{ chamadoId: IChamadoN1 }>('chamadoId')
    .lean();
  return rows
    .filter((row) => row.chamadoId)
    .map((row) => ({
      id: String(row.chamadoId._id),
      protocolo: row.chamadoProtocolo,
      titulo: row.chamadoId.chamadoTitulo,
      motivo: row.motivo,
      sentimento: row.sentimentoClasse,
      casoGrave: row.casoGrave,
      qualidadeFonte: row.qualidadeFonte,
      analisadoEm: row.analisadoEm,
    }));
}
