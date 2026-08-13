/** hugmeImport.service v1.0.0 — upsert base Hugme + tickets incrementais */
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
import { createRaTicketFromHugmeRegistro } from './reclameAquiTicketCreate.service';

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
    motivo: row.motivo ?? '',
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

export async function importHugmeBuffer(
  buffer: Buffer,
  options: HugmeImportOptions,
): Promise<HugmeImportResult> {
  const batchId = options.batchId || randomUUID();
  const now = new Date();
  const parse = parseHugmeBuffer(buffer);
  const RegistroModel = getReclameAquiHugmeRegistroModel();
  const BatchModel = getReclameAquiHugmeImportBatchModel();

  const stats = {
    total: parse.rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    ticketsCreated: 0,
    failed: 0,
  };
  const rows: HugmeImportRowResult[] = [];
  const errors: Array<{ rowIndex: number; idOrigem?: string; message: string }> = [];

  for (const row of parse.rows) {
    if (row.status !== 'valid') {
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
      continue;
    }

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

      if (options.modo === 'incremental' && !doc.chamadoId) {
        const ticketResult = await createRaTicketFromHugmeRegistro(
          doc,
          options.importedBy || 'sistema',
        );
        doc.chamadoId = ticketResult.chamadoId;
        doc.chamadoProtocolo = ticketResult.chamadoProtocolo;
        doc.reclamacaoId = ticketResult.reclamacaoId ?? null;
        doc.ticketCriadoEm = now;
        await doc.save();
        ticketCreated = true;
        chamadoId = ticketResult.chamadoId.toString();
        stats.ticketsCreated += 1;
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
      const message = err instanceof Error ? err.message : 'Erro ao importar linha';
      rows.push({
        rowIndex: row.rowIndex,
        idOrigem: row.idOrigem,
        action: 'failed',
        errors: [message],
      });
      errors.push({ rowIndex: row.rowIndex, idOrigem: row.idOrigem, message });
    }
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

  return { batchId, parse, stats, rows, errors };
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

export async function listHugmeImportBatches(limit = 50) {
  const items = await getReclameAquiHugmeImportBatchModel()
    .find({})
    .sort({ importedAt: -1 })
    .limit(Math.min(limit, 200))
    .exec();

  return items.map((batch) => ({
    batchId: batch.batchId,
    modo: batch.modo,
    fileName: batch.fileName,
    total: batch.total,
    inserted: batch.inserted,
    updated: batch.updated,
    skipped: batch.skipped,
    ticketsCreated: batch.ticketsCreated,
    failed: batch.failed,
    importedAt: batch.importedAt,
    importedBy: batch.importedBy,
  }));
}

export async function findHugmeRegistroDocByIdOrigem(idOrigem: string) {
  return getReclameAquiHugmeRegistroModel()
    .findOne({ idOrigem: String(idOrigem).trim() })
    .exec();
}

export type { IReclameAquiHugmeRegistro } from '../../models/reclamacoes/ReclameAquiHugmeRegistro.schema';
