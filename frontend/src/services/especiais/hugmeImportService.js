/**
 * hugmeImportService — parse e importação em lote de planilhas Hugme (Reclame Aqui)
 */
import * as XLSX from 'xlsx';
import { loadAllReclamacoes } from './reclameAquiStore';
import { registerReclamacaoAndCreateTicket } from './reclameAquiTicketService';

/** Aliases de colunas — export Hugme "Base Completa" (Relatório de Tickets) */
export const HUGME_COLUMN_MAP = {
  consumidor: [
    'nome',
    'consumidor',
    'nome do consumidor',
    'cliente',
  ],
  nomeSocial: ['nome social do consumidor'],
  cpf: ['cpf/cnpj', 'cpf', 'cpf cnpj', 'documento'],
  email: ['email', 'e-mail'],
  telefoneWhatsapp: ['telefones', 'telefone', 'celular', 'whatsapp'],
  assunto: ['titulo', 'título', 'assunto'],
  descricao: ['texto da reclamacao', 'texto da reclamação', 'descricao', 'descrição'],
  consideracaoConsumidor: ['consideracao consumidor', 'consideração consumidor'],
  idReclamacaoRa: ['id hugme', 'id ra'],
  protocoloRa: ['id origem', 'protocolo', 'protocolo ra'],
  dataReclamacao: ['data reclamacao', 'data reclamação', 'data da reclamacao', 'data da reclamação'],
  dataResposta: ['data de resposta', 'data da resposta'],
  produto: ['produto ra', 'produto', 'produto/servico', 'produto/serviço'],
  motivoRa: ['motivo da reclamacao ra', 'motivo da reclamação ra'],
  categoriaRa: ['categoria ra'],
  problemaRa: ['problema ra'],
  statusRaLabel: ['status ra'],
  statusHugme: ['status hugme'],
  origem: ['origem'],
  respostaPublica: ['resposta da empresa', 'resposta publica', 'resposta pública'],
  nota: ['nota'],
  cidade: ['cidade'],
  estado: ['estado'],
};

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function cellToString(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseExcelDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0));
      return d.toISOString();
    }
  }
  const str = String(value).trim();
  if (!str) return null;

  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
    const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    const d = new Date(year, month, day, hour, minute);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const iso = new Date(str);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  return null;
}

function buildHeaderIndex(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const index = {};

  Object.entries(HUGME_COLUMN_MAP).forEach(([field, aliases]) => {
    const matchIdx = normalized.findIndex((h) => h && aliases.includes(h));
    if (matchIdx >= 0) index[field] = matchIdx;
  });

  return index;
}

/** Planilhas Hugme incluem linhas de título ("Base Completa") antes do cabeçalho real. */
export function detectHugmeHeaderRow(matrix, scanLimit = 25) {
  for (let i = 0; i < Math.min(scanLimit, matrix.length); i += 1) {
    const normalized = (matrix[i] || []).map((h) => normalizeHeader(h));
    const hasNome = normalized.includes('nome');
    const hasCpf = normalized.includes('cpf/cnpj');
    const hasIdHugme = normalized.includes('id hugme');
    const hasTitulo = normalized.includes('titulo') || normalized.includes('título');
    if (hasNome && hasCpf && (hasIdHugme || hasTitulo)) {
      return i;
    }
  }
  return 0;
}

function isMetadataRow(row) {
  const first = cellToString(row[0]).toLowerCase();
  if (first === 'base completa') return true;
  if (first === 'origem') return true;
  return false;
}

function isDataRow(row, headerIndex) {
  if (isEmptyRow(row) || isMetadataRow(row)) return false;
  const idOrigem = headerIndex.protocoloRa != null ? cellToString(row[headerIndex.protocoloRa]) : '';
  const idHugme = headerIndex.idReclamacaoRa != null ? cellToString(row[headerIndex.idReclamacaoRa]) : '';
  const nome = headerIndex.consumidor != null ? cellToString(row[headerIndex.consumidor]) : '';
  return Boolean(idOrigem || idHugme || nome);
}

function buildMotivo(row, headerIndex) {
  const parts = [
    getFieldFromRow(row, headerIndex, 'motivoRa'),
    getFieldFromRow(row, headerIndex, 'categoriaRa'),
    getFieldFromRow(row, headerIndex, 'problemaRa'),
  ].filter(Boolean);
  return parts.length ? parts.join(' — ') : undefined;
}

function buildDescricao(row, headerIndex) {
  const texto = getFieldFromRow(row, headerIndex, 'descricao');
  const consideracao = getFieldFromRow(row, headerIndex, 'consideracaoConsumidor');
  if (!consideracao) return texto;
  if (!texto) return consideracao;
  return `${texto}\n\nConsideração do consumidor:\n${consideracao}`;
}

function mapStatusRaFromHugme(label) {
  const value = normalizeHeader(label);
  if (!value) return undefined;
  if (value.includes('replica') || value.includes('nao respond') || value.includes('não respond')) {
    return 'nao-respondida';
  }
  if (value === 'respondido') return 'respondida';
  if (value.includes('avaliado')) return 'aguard-avaliacao';
  if (value.includes('workflow')) return 'workflow-ativo';
  return undefined;
}

function getFieldFromRow(row, headerIndex, field) {
  const idx = headerIndex[field];
  if (idx == null) return '';
  return cellToString(row[idx]);
}

export function mapRowToReclamacao(row, headerIndex, rowIndex) {
  const consumidor = getFieldFromRow(row, headerIndex, 'consumidor')
    || getFieldFromRow(row, headerIndex, 'nomeSocial');
  const assunto = getFieldFromRow(row, headerIndex, 'assunto');
  const descricao = buildDescricao(row, headerIndex);
  const idReclamacaoRa = getFieldFromRow(row, headerIndex, 'idReclamacaoRa');
  const idOrigem = getFieldFromRow(row, headerIndex, 'protocoloRa');
  const cpfRaw = getFieldFromRow(row, headerIndex, 'cpf');
  const dataReclamacao = parseExcelDate(
    headerIndex.dataReclamacao != null ? row[headerIndex.dataReclamacao] : '',
  );
  const statusRaLabel = getFieldFromRow(row, headerIndex, 'statusRaLabel');
  const statusRa = mapStatusRaFromHugme(statusRaLabel);

  return {
    id: `ra-hugme-row-${rowIndex}`,
    consumidor,
    cpf: normalizeCpf(cpfRaw),
    email: getFieldFromRow(row, headerIndex, 'email'),
    telefoneWhatsapp: getFieldFromRow(row, headerIndex, 'telefoneWhatsapp'),
    assunto,
    descricao: descricao || assunto,
    idReclamacaoRa: idReclamacaoRa || idOrigem,
    protocoloRa: idOrigem ? `RA-ORIG-${idOrigem}` : '',
    dataReclamacao: dataReclamacao || undefined,
    produto: getFieldFromRow(row, headerIndex, 'produto') || undefined,
    tipo: getFieldFromRow(row, headerIndex, 'origem') || 'Reclamação',
    motivo: buildMotivo(row, headerIndex),
    respostaPublica: getFieldFromRow(row, headerIndex, 'respostaPublica') || undefined,
    statusRa,
    hugmeMeta: {
      idOrigem: idOrigem || undefined,
      statusHugme: getFieldFromRow(row, headerIndex, 'statusHugme') || undefined,
      statusRaLabel: statusRaLabel || undefined,
      nota: getFieldFromRow(row, headerIndex, 'nota') || undefined,
      cidade: getFieldFromRow(row, headerIndex, 'cidade') || undefined,
      estado: getFieldFromRow(row, headerIndex, 'estado') || undefined,
    },
  };
}

function isEmptyRow(row) {
  return !row.some((cell) => cellToString(cell));
}

function collectExistingKeys() {
  const items = loadAllReclamacoes();
  const ids = new Set();
  const protocols = new Set();
  items.forEach((item) => {
    const idRa = String(item.idReclamacaoRa || '').trim().toLowerCase();
    const proto = String(item.protocoloRa || '').trim().toLowerCase();
    if (idRa) ids.add(idRa);
    if (proto) protocols.add(proto);
  });
  return { ids, protocols };
}

export function validateHugmeRow(form, existingKeys) {
  const errors = [];
  if (!form.consumidor?.trim()) errors.push('Consumidor obrigatório');
  if (!form.assunto?.trim() && !form.descricao?.trim()) {
    errors.push('Assunto ou descrição obrigatório');
  }

  const idKey = String(form.idReclamacaoRa || '').trim().toLowerCase();
  const protoKey = String(form.protocoloRa || '').trim().toLowerCase();

  if (idKey && existingKeys.ids.has(idKey)) {
    return { status: 'duplicate', errors: ['ID RA já cadastrado'], form };
  }
  if (protoKey && existingKeys.protocols.has(protoKey)) {
    return { status: 'duplicate', errors: ['Protocolo RA já cadastrado'], form };
  }

  if (errors.length) {
    return { status: 'invalid', errors, form };
  }

  if (idKey) existingKeys.ids.add(idKey);
  if (protoKey) existingKeys.protocols.add(protoKey);

  return { status: 'valid', errors: [], form };
}

export function prepareHugmeImport(rawRows, headers, { headerRowIndex = 0 } = {}) {
  const headerIndex = buildHeaderIndex(headers);
  const dataRows = rawRows.filter((row) => isDataRow(row, headerIndex));
  const existingKeys = collectExistingKeys();
  const missingColumns = [];

  if (headerIndex.consumidor == null && headerIndex.nomeSocial == null) {
    missingColumns.push('Nome');
  }
  if (headerIndex.assunto == null && headerIndex.descricao == null) {
    missingColumns.push('Título/Texto da Reclamação');
  }

  const rows = dataRows.map((row, index) => {
    const form = mapRowToReclamacao(row, headerIndex, headerRowIndex + index + 2);
    const result = validateHugmeRow(form, existingKeys);
    return {
      rowIndex: headerRowIndex + index + 2,
      form: result.form,
      status: result.status,
      errors: result.errors,
    };
  });

  return {
    rows,
    headerIndex,
    headerRowIndex,
    missingColumns,
    stats: {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicate: rows.filter((r) => r.status === 'duplicate').length,
    },
  };
}

export async function parseHugmeFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const ext = ACCEPTED_EXTENSIONS.find((e) => name.endsWith(e));
  const mime = String(file?.type || '').toLowerCase();
  const mimeOk = mime.includes('spreadsheet')
    || mime.includes('excel')
    || mime === 'text/csv'
    || mime === 'application/vnd.ms-excel';
  if (!ext && !mimeOk) {
    throw new Error('Formato não suportado. Use .xlsx, .xls ou .csv.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Planilha vazia.');

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  if (!matrix.length) throw new Error('Nenhuma linha encontrada na planilha.');

  const headerRowIndex = detectHugmeHeaderRow(matrix);
  const headers = (matrix[headerRowIndex] || []).map((h) => cellToString(h));
  const rawRows = matrix.slice(headerRowIndex + 1);

  return prepareHugmeImport(rawRows, headers, { headerRowIndex });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function importHugmeRows(validRows, { onProgress, throttleMs = 200 } = {}) {
  const result = {
    created: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const toImport = validRows.filter((r) => r.status === 'valid');
  result.skipped = validRows.length - toImport.length;

  for (let i = 0; i < toImport.length; i += 1) {
    const row = toImport[i];
    onProgress?.({ current: i + 1, total: toImport.length, row });

    try {
      const created = await registerReclamacaoAndCreateTicket({
        ...row.form,
        id: row.form.id || `ra-hugme-${row.rowIndex}-${Date.now()}`,
      });
      result.created += 1;
      result.details.push({
        rowIndex: row.rowIndex,
        status: 'created',
        ticketId: created.ticketId,
        consumidor: row.form.consumidor,
      });
    } catch (err) {
      result.failed += 1;
      result.details.push({
        rowIndex: row.rowIndex,
        status: 'failed',
        consumidor: row.form.consumidor,
        error: err?.message || 'Erro ao criar ticket',
      });
    }

    if (i < toImport.length - 1 && throttleMs > 0) {
      await delay(throttleMs);
    }
  }

  return result;
}

export function buildErrorReportCsv(failedRows) {
  const header = 'Linha;Consumidor;Status;Erro\n';
  const lines = failedRows.map((r) =>
    [r.rowIndex, r.consumidor || r.form?.consumidor || '', r.status, (r.errors || [r.error]).join(' | ')]
      .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(';'),
  );
  return header + lines.join('\n');
}

export function downloadErrorReport(failedRows, filename = 'hugme-import-erros.csv') {
  const csv = buildErrorReportCsv(failedRows);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const HUGME_ACCEPT = '.xlsx,.xls,.csv';
