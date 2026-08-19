/** hugmeImport.service v1.2.0 — lote em background; progresso persistido a cada ticket */
import { randomUUID } from 'crypto';
import type { IReclameAquiHugmeRegistro, HugmeOrigemImportacao } from '../../models/reclamacoes/ReclameAquiHugmeRegistro.schema';
import {
  getReclameAquiHugmeImportBatchModel,
  getReclameAquiHugmeRegistroModel,
} from '../../models/reclamacoes/hugmeModels';
import {
  parseHugmeBuffer,
  type HugmeParseResult,
  type ParsedHugmeRow,
} from './hugmeSpreadsheet.service';
import {
  parsedRowToRaTicketSource,
  upsertRaTicketFromSource,
} from './reclameAquiTicketCreate.service';

export interface HugmeImportOptions {
  modo: HugmeOrigemImportacao;
  fileName?: string;
  importedBy?: string;
  batchId?: string;
}

export interface HugmeImportRowResult {
  rowIndex: number;
  idOrigem: string;
  action: 'inserted' | 'updated' | 'skipped' | 'failed';
  ticketCreated?: boolean;
  chamadoId?: string;
  errors?: string[];
}

export interface HugmeImportResult {
  batchId: string;
  parse: HugmeParseResult;
  stats: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    ticketsCreated: number;
    failed: number;
  };
  rows: HugmeImportRowResult[];
  errors: Array<{ rowIndex: number; idOrigem?: string; message: string }>;
}

function mergeColunasOriginais(
  existing: Record<string, string> | undefined,
  incoming: Record<string, string>,
): Record<string, string> {
  return { ...(existing ?? {}), ...incoming };
}

function buildRegistroPayload(
  row: ParsedHugmeRow,
  modo: HugmeOrigemImportacao,
  batchId: string,
  now: Date,
) {
  return {
    idOrigem: row.idOrigem.trim(),
    idHugme: row.idHugme || row.idReclamacaoRa || '',
    colunasOriginais: row.colunasOriginais,
    cabecalhos: row.cabecalhos,
    consumidor: row.consumidor,
    cpf: row.cpf,
    email: row.email,
    telefoneWhatsapp: row.telefoneWhatsapp,
    assunto: row.assunto,
    descricao: row.descricao,
    produto: row.produto ?? '',
    tipo: row.tipo ?? 'Reclamação',
    motivo: row.hugmeMotivoRa ?? row.motivo ?? '',
    nota: row.nota ?? '',
    statusRa: row.statusRa ?? '',
    statusHugme: row.statusHugme ?? '',
    statusRaLabel: row.statusRaLabel ?? '',
    dataReclamacao: row.dataReclamacao ? new Date(row.dataReclamacao) : undefined,
    dataResposta: row.dataResposta ? new Date(row.dataResposta) : undefined,
    respostaPublica: row.respostaPublica ?? '',
    cidade: row.cidade ?? '',
    uf: row.uf ?? '',
    ultimoImportBatchId: batchId,
    ultimoImportEm: now,
    origemImportacao: modo,
  };
}

function registroToPortalDto(doc: IReclameAquiHugmeRegistro) {
  return {
    id: String(doc._id),
    idOrigem: doc.idOrigem,
    idHugme: doc.idHugme,
    consumidor: doc.consumidor,
    cpf: doc.cpf,
    email: doc.email,
    telefoneWhatsapp: doc.telefoneWhatsapp,
    assunto: doc.assunto,
    descricao: doc.descricao,
    produto: doc.produto,
    tipo: doc.tipo,
    motivo: doc.motivo,
    nota: doc.nota,
    statusRa: doc.statusRa,
    statusHugme: doc.statusHugme,
    statusRaLabel: doc.statusRaLabel,
    dataReclamacao: doc.dataReclamacao,
    dataResposta: doc.dataResposta,
    respostaPublica: doc.respostaPublica,
    cidade: doc.cidade,
    uf: doc.uf,
    colunasOriginais: doc.colunasOriginais,
    cabecalhos: doc.cabecalhos,
    chamadoId: doc.chamadoId ? String(doc.chamadoId) : null,
    chamadoProtocolo: doc.chamadoProtocolo || null,
    reclamacaoId: doc.reclamacaoId ? String(doc.reclamacaoId) : null,
    ticketCriadoEm: doc.ticketCriadoEm,
    ultimoImportBatchId: doc.ultimoImportBatchId,
    primeiroImportEm: doc.primeiroImportEm,
    ultimoImportEm: doc.ultimoImportEm,
    origemImportacao: doc.origemImportacao,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export { registroToPortalDto };

export type HugmeImportStats = HugmeImportResult['stats'];

export interface HugmeImportStarted {
  batchId: string;
  parse: HugmeParseResult;
  stats: HugmeImportStats;
  rows: HugmeImportRowResult[];
  errors: HugmeImportResult['errors'];
  options: HugmeImportOptions;
  now: Date;
}

export interface HugmeImportBatchView {
  batchId: string;
  modo: HugmeOrigemImportacao;
  fileName: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  ticketsCreated: number;
  failed: number;
  processed: number;
  running: boolean;
  importedAt: Date;
  importedBy?: string;
  errors?: Array<{ rowIndex: number; idOrigem?: string; message: string }>;
}

let hugmeImportInProcess = false;

export function computeHugmeProcessed(stats: Pick<HugmeImportStats, 'inserted' | 'updated' | 'skipped' | 'failed'>): number {
  return stats.inserted + stats.updated + stats.skipped + stats.failed;
}

export function isHugmeBatchRunning(stats: Pick<HugmeImportStats, 'total' | 'inserted' | 'updated' | 'skipped' | 'failed'>): boolean {
  return computeHugmeProcessed(stats) < stats.total;
}

function mapHugmeBatch(
  batch: {
    batchId: string;
    modo: HugmeOrigemImportacao;
    fileName?: string;
    total?: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    ticketsCreated?: number;
    failed?: number;
    importedAt: Date;
    importedBy?: string;
    batchErrors?: Array<{ rowIndex: number; idOrigem?: string; message: string }>;
  },
  includeErrors = false,
): HugmeImportBatchView {
  const stats = {
    total: batch.total || 0,
    inserted: batch.inserted || 0,
    updated: batch.updated || 0,
    skipped: batch.skipped || 0,
    ticketsCreated: batch.ticketsCreated || 0,
    failed: batch.failed || 0,
  };
  const processed = computeHugmeProcessed(stats);
  return {
    batchId: batch.batchId,
    modo: batch.modo,
    fileName: batch.fileName || '',
    ...stats,
    processed,
    running: processed < stats.total,
    importedAt: batch.importedAt,
    importedBy: batch.importedBy,
    ...(includeErrors ? { errors: (batch.batchErrors || []).slice(0, 100) } : {}),
  };
}

async function persistHugmeBatchProgress(
  batchId: string,
  stats: HugmeImportStats,
  errors: HugmeImportResult['errors'],
): Promise<void> {
  await getReclameAquiHugmeImportBatchModel().updateOne(
    { batchId },
    {
      $set: {
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        ticketsCreated: stats.ticketsCreated,
        failed: stats.failed,
        batchErrors: errors.slice(0, 500),
      },
    },
  ).exec();
}

export async function beginHugmeImport(
  buffer: Buffer,
  options: HugmeImportOptions,
): Promise<HugmeImportStarted> {
  if (hugmeImportInProcess) {
    throw Object.assign(new Error('Já existe uma importação Hugme em andamento.'), { status: 409 });
  }
  hugmeImportInProcess = true;

  try {
    const batchId = options.batchId || randomUUID();
    const now = new Date();
    const parse = parseHugmeBuffer(buffer);
    const BatchModel = getReclameAquiHugmeImportBatchModel();

    const stats: HugmeImportStats = {
      total: parse.rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      ticketsCreated: 0,
      failed: 0,
    };
    const rows: HugmeImportRowResult[] = [];
    const errors: HugmeImportResult['errors'] = [];

    for (const row of parse.rows) {
      if (row.status === 'valid') continue;
      stats.skipped += 1;
      rows.push({
        rowIndex: row.rowIndex,
        idOrigem: row.idOrigem,
        action: 'skipped',
        errors: row.errors,
      });
      errors.push({
        rowIndex: row.rowIndex,
        idOrigem: row.idOrigem,
        message: row.errors.join('; ') || row.status,
      });
    }

    await BatchModel.create({
      batchId,
      modo: options.modo,
      fileName: options.fileName || '',
      total: stats.total,
      inserted: stats.inserted,
      updated: stats.updated,
      skipped: stats.skipped,
      ticketsCreated: stats.ticketsCreated,
      failed: stats.failed,
      batchErrors: errors.slice(0, 500),
      importedAt: now,
      importedBy: options.importedBy || '',
    });

    console.info('[hugme-import] início', {
      batchId,
      fileName: options.fileName || '',
      total: parse.rows.length,
      valid: parse.rows.length - stats.skipped,
    });

    return {
      batchId,
      parse,
      stats,
      rows,
      errors,
      options: { ...options, batchId },
      now,
    };
  } catch (err) {
    hugmeImportInProcess = false;
    throw err;
  }
}

export async function runHugmeImportLoop(started: HugmeImportStarted): Promise<HugmeImportResult> {
  const { batchId, parse, stats, rows, errors, now } = started;
  const options = started.options;
  const RegistroModel = getReclameAquiHugmeRegistroModel();
  const validRows = parse.rows.filter((row) => row.status === 'valid');
  const validTotal = validRows.length;
  let processedValid = 0;

  try {
    for (const row of validRows) {
      try {
        const existing = await RegistroModel.findOne({ idOrigem: row.idOrigem.trim() }).exec();
        const payload = buildRegistroPayload(row, options.modo, batchId, now);

        let doc: IReclameAquiHugmeRegistro;
        let action: 'inserted' | 'updated';

        if (existing) {
          existing.set({
            ...payload,
            colunasOriginais: mergeColunasOriginais(
              existing.colunasOriginais as Record<string, string>,
              row.colunasOriginais,
            ),
            cabecalhos: row.cabecalhos.length ? row.cabecalhos : existing.cabecalhos,
          });
          doc = await existing.save();
          action = 'updated';
          stats.updated += 1;
        } else {
          doc = await RegistroModel.create({
            ...payload,
            primeiroImportEm: now,
          });
          action = 'inserted';
          stats.inserted += 1;
        }

        let ticketCreated = false;
        let chamadoId: string | undefined;

        const ticketResult = await upsertRaTicketFromSource(
          parsedRowToRaTicketSource(row),
          options.importedBy || 'sistema',
          'hugme-import',
        );
        doc.chamadoId = ticketResult.chamadoId;
        doc.chamadoProtocolo = ticketResult.chamadoProtocolo;
        doc.reclamacaoId = ticketResult.reclamacaoId;
        if (!ticketResult.updated) {
          doc.ticketCriadoEm = now;
          ticketCreated = true;
          stats.ticketsCreated += 1;
        }
        await doc.save();
        chamadoId = ticketResult.chamadoId.toString();

        processedValid += 1;
        await persistHugmeBatchProgress(batchId, stats, errors).catch(() => undefined);
        if (processedValid === 1 || processedValid % 25 === 0 || processedValid === validTotal) {
          console.info('[hugme-import] progresso', {
            batchId,
            processed: processedValid,
            valid: validTotal,
            ticketsCreated: stats.ticketsCreated,
            failed: stats.failed,
          });
        }

        rows.push({
          rowIndex: row.rowIndex,
          idOrigem: row.idOrigem,
          action,
          ticketCreated,
          chamadoId,
        });
      } catch (err) {
        stats.failed += 1;
        processedValid += 1;
        const message = err instanceof Error ? err.message : 'Erro ao importar linha';
        rows.push({
          rowIndex: row.rowIndex,
          idOrigem: row.idOrigem,
          action: 'failed',
          errors: [message],
        });
        errors.push({ rowIndex: row.rowIndex, idOrigem: row.idOrigem, message });
        await persistHugmeBatchProgress(batchId, stats, errors).catch(() => undefined);
      }
    }

    await persistHugmeBatchProgress(batchId, stats, errors);
    console.info('[hugme-import] fim', { batchId, stats });
    return { batchId, parse, stats, rows, errors };
  } catch (err) {
    const remaining = Math.max(0, stats.total - computeHugmeProcessed(stats));
    if (remaining > 0) stats.failed += remaining;
    errors.push({
      rowIndex: 0,
      message: err instanceof Error ? err.message : 'Falha no lote Hugme',
    });
    await persistHugmeBatchProgress(batchId, stats, errors).catch(() => undefined);
    throw err;
  } finally {
    hugmeImportInProcess = false;
  }
}

export async function importHugmeBuffer(
  buffer: Buffer,
  options: HugmeImportOptions,
): Promise<HugmeImportResult> {
  const started = await beginHugmeImport(buffer, options);
  return runHugmeImportLoop(started);
}

export interface HugmeRegistroListFilters {
  semTicket?: boolean;
  limit?: number;
  skip?: number;
}

export async function listHugmeRegistros(filters: HugmeRegistroListFilters = {}) {
  const Model = getReclameAquiHugmeRegistroModel();
  const query: Record<string, unknown> = {};
  if (filters.semTicket) {
    query.chamadoId = { $in: [null, undefined] };
  }
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const skip = Math.max(filters.skip ?? 0, 0);

  const [items, total] = await Promise.all([
    Model.find(query).sort({ ultimoImportEm: -1 }).skip(skip).limit(limit).exec(),
    Model.countDocuments(query),
  ]);

  return {
    items: items.map(registroToPortalDto),
    total,
  };
}

export async function getHugmeRegistroByIdOrigem(idOrigem: string) {
  const doc = await getReclameAquiHugmeRegistroModel()
    .findOne({ idOrigem: String(idOrigem).trim() })
    .exec();
  return doc ? registroToPortalDto(doc) : null;
}

export async function getHugmeImportStats() {
  const Model = getReclameAquiHugmeRegistroModel();
  const BatchModel = getReclameAquiHugmeImportBatchModel();

  const [total, comTicket, semTicket, ultimoBatch] = await Promise.all([
    Model.countDocuments({}),
    Model.countDocuments({ chamadoId: { $ne: null } }),
    Model.countDocuments({ $or: [{ chamadoId: null }, { chamadoId: { $exists: false } }] }),
    BatchModel.findOne({}).sort({ importedAt: -1 }).exec(),
  ]);

  return {
    total,
    comTicket,
    semTicket,
    ultimoImport: ultimoBatch ? {
      batchId: ultimoBatch.batchId,
      modo: ultimoBatch.modo,
      fileName: ultimoBatch.fileName,
      importedAt: ultimoBatch.importedAt,
      inserted: ultimoBatch.inserted,
      updated: ultimoBatch.updated,
      ticketsCreated: ultimoBatch.ticketsCreated,
    } : null,
  };
}

export async function getHugmeImportBatch(batchId: string): Promise<HugmeImportBatchView | null> {
  const batch = await getReclameAquiHugmeImportBatchModel()
    .findOne({ batchId: String(batchId).trim() })
    .exec();
  return batch ? mapHugmeBatch(batch, true) : null;
}

export async function listHugmeImportBatches(limit = 50) {
  const items = await getReclameAquiHugmeImportBatchModel()
    .find({})
    .sort({ importedAt: -1 })
    .limit(Math.min(limit, 200))
    .exec();

  return items.map((batch) => mapHugmeBatch(batch, false));
}

export async function findHugmeRegistroDocByIdOrigem(idOrigem: string) {
  return getReclameAquiHugmeRegistroModel()
    .findOne({ idOrigem: String(idOrigem).trim() })
    .exec();
}

export type { IReclameAquiHugmeRegistro } from '../../models/reclamacoes/ReclameAquiHugmeRegistro.schema';
