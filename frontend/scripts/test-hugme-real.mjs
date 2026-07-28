/**
 * Teste com planilha Hugme real (header na linha 4, 1665+ tickets)
 * node scripts/test-hugme-real.mjs [caminho.xlsx]
 */
import * as XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';

const defaultPath = 'c:/Users/Velotax Suporte/Downloads/4358_base-completa_1785184390002 (1).xlsx';
const filePath = process.argv[2] || defaultPath;

if (!existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(1);
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

const HUGME_COLUMN_MAP = {
  consumidor: ['nome'],
  cpf: ['cpf/cnpj'],
  assunto: ['titulo', 'título'],
  descricao: ['texto da reclamacao', 'texto da reclamação'],
  idReclamacaoRa: ['id hugme'],
  protocoloRa: ['id origem'],
  dataReclamacao: ['data reclamacao', 'data reclamação'],
  produto: ['produto ra'],
  respostaPublica: ['resposta da empresa'],
};

function buildHeaderIndex(headers) {
  const normalized = headers.map((h) => normalizeHeader(h));
  const index = {};
  Object.entries(HUGME_COLUMN_MAP).forEach(([field, aliases]) => {
    const matchIdx = normalized.findIndex((h) => h && aliases.includes(h));
    if (matchIdx >= 0) index[field] = matchIdx;
  });
  return index;
}

function detectHugmeHeaderRow(matrix) {
  for (let i = 0; i < Math.min(25, matrix.length); i += 1) {
    const n = (matrix[i] || []).map((h) => normalizeHeader(h));
    if (n.includes('nome') && n.includes('cpf/cnpj') && n.includes('id hugme')) return i;
  }
  return 0;
}

const wb = XLSX.read(readFileSync(filePath), { type: 'buffer', cellDates: true });
const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
const headerRowIndex = detectHugmeHeaderRow(matrix);
const headers = matrix[headerRowIndex];
const headerIndex = buildHeaderIndex(headers.map(String));

console.log('Arquivo:', filePath);
console.log('Header row:', headerRowIndex + 1);
console.log('Colunas mapeadas:', Object.keys(headerIndex).join(', '));

const dataRows = matrix.slice(headerRowIndex + 1).filter((row) => {
  const id = headerIndex.protocoloRa != null ? String(row[headerIndex.protocoloRa] || '').trim() : '';
  const nome = headerIndex.consumidor != null ? String(row[headerIndex.consumidor] || '').trim() : '';
  return id || nome;
});

console.log('Linhas de dados:', dataRows.length);

const sample = dataRows[0];
const get = (field) => String(sample[headerIndex[field]] ?? '').slice(0, 60);
console.log('\nAmostra linha 1:');
console.log('  Nome:', get('consumidor'));
console.log('  Id Origem:', get('protocoloRa'));
console.log('  Id HugMe:', get('idReclamacaoRa'));
console.log('  Título:', get('assunto'));
console.log('  Produto:', get('produto'));

const required = ['consumidor', 'assunto', 'descricao', 'idReclamacaoRa', 'protocoloRa'];
const missing = required.filter((f) => headerIndex[f] == null && !(f === 'assunto' && headerIndex.descricao != null));
if (missing.length) {
  console.error('\nFALHA — colunas não mapeadas:', missing.join(', '));
  process.exit(1);
}

console.log('\nOK — planilha Hugme real compatível com o importador.');
process.exit(0);
