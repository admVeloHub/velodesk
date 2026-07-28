/**
 * Teste local do parser Hugme (node scripts/test-hugme-import.mjs)
 * Self-contained — não importa módulos do frontend (localStorage/API).
 */
import * as XLSX from 'xlsx';

const HUGME_COLUMN_MAP = {
  consumidor: ['consumidor', 'nome do consumidor', 'nome'],
  cpf: ['cpf', 'documento'],
  assunto: ['assunto', 'titulo', 'título'],
  descricao: ['descricao', 'descrição', 'texto da reclamação'],
  idReclamacaoRa: ['id reclamacao', 'id reclamação', 'id'],
  protocoloRa: ['protocolo', 'protocolo ra'],
  prazoRa: ['prazo resposta', 'prazo'],
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function buildHeaderIndex(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const index = {};
  Object.entries(HUGME_COLUMN_MAP).forEach(([field, aliases]) => {
    const matchIdx = normalized.findIndex((h) => aliases.includes(h));
    if (matchIdx >= 0) index[field] = matchIdx;
  });
  return index;
}

function getField(row, headerIndex, field) {
  const idx = headerIndex[field];
  if (idx == null) return '';
  return String(row[idx] ?? '').trim();
}

function validateRow(form, keys) {
  const errors = [];
  if (!form.consumidor) errors.push('Consumidor obrigatório');
  if (!form.assunto && !form.descricao) errors.push('Assunto ou descrição obrigatório');
  const idKey = String(form.idReclamacaoRa || '').toLowerCase();
  const protoKey = String(form.protocoloRa || '').toLowerCase();
  if (idKey && keys.ids.has(idKey)) return { status: 'duplicate', errors: ['ID duplicado'] };
  if (protoKey && keys.protocols.has(protoKey)) return { status: 'duplicate', errors: ['Protocolo duplicado'] };
  if (errors.length) return { status: 'invalid', errors };
  if (idKey) keys.ids.add(idKey);
  if (protoKey) keys.protocols.add(protoKey);
  return { status: 'valid', errors: [] };
}

const sampleRows = [
  ['ID Reclamação', 'Protocolo', 'Consumidor', 'CPF', 'Assunto', 'Descrição', 'Prazo resposta'],
  ['RA-EXT-1001', 'RA-2026-00010001', 'Maria Silva', '12345678901', 'Cobrança indevida', 'Fui cobrada duas vezes', '28/07/2026'],
  ['RA-EXT-1002', 'RA-2026-00010002', '', '98765432100', 'Sem consumidor', 'Linha inválida', '29/07/2026'],
  ['RA-EXT-1001', 'RA-2026-00010001', 'Maria Silva', '12345678901', 'Duplicada', 'Mesmo ID', '28/07/2026'],
];

const ws = XLSX.utils.aoa_to_sheet(sampleRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Hugme');
const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
const workbook = XLSX.read(buffer, { type: 'buffer' });
const matrix = XLSX.utils.sheet_to_json(workbook.Sheets.Hugme, { header: 1, defval: '', raw: true });
const headerIndex = buildHeaderIndex(matrix[0].map(String));
const keys = { ids: new Set(), protocols: new Set() };

const rows = matrix.slice(1).map((row, i) => {
  const form = {
    consumidor: getField(row, headerIndex, 'consumidor'),
    assunto: getField(row, headerIndex, 'assunto'),
    descricao: getField(row, headerIndex, 'descricao'),
    idReclamacaoRa: getField(row, headerIndex, 'idReclamacaoRa'),
    protocoloRa: getField(row, headerIndex, 'protocoloRa'),
  };
  const { status, errors } = validateRow(form, keys);
  return { rowIndex: i + 2, status, errors, form };
});

const stats = {
  valid: rows.filter((r) => r.status === 'valid').length,
  invalid: rows.filter((r) => r.status === 'invalid').length,
  duplicate: rows.filter((r) => r.status === 'duplicate').length,
};

console.log('Stats:', stats);
rows.forEach((r) => console.log(`  L${r.rowIndex} [${r.status}]`, r.form.consumidor, r.errors.join('; ') || 'ok'));

if (stats.valid === 1 && stats.invalid === 1 && stats.duplicate === 1) {
  console.log('\nOK — parser, validação e dedupe interno funcionando.');
  process.exit(0);
}

console.error('\nFALHA — stats inesperados:', stats);
process.exit(1);
