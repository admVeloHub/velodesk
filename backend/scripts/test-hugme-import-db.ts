/** test-hugme-import-db v1.0.0 — parser + regras de import Hugme */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as XLSX from 'xlsx';
import {
  buildColunasOriginais,
  parseHugmeBuffer,
  prepareHugmeImport,
} from '../src/services/reclame-aqui/hugmeSpreadsheet.service';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildSampleWorkbook(rows: Record<string, string>[]) {
  const headers = [
    'Nome',
    'CPF/CNPJ',
    'Id HugMe',
    'Id Origem',
    'Título',
    'Texto da Reclamação',
    'Produto RA',
    'Data Reclamação',
    'Status RA',
    'Nota',
    'Cidade',
    'Estado',
  ];

  const matrix: unknown[][] = [
    ['Base Completa'],
    [''],
    ['Origem'],
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? '')),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Base');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function testColunasOriginaisAllHeaders() {
  const headers = ['Nome', 'Nota', 'Campo Extra'];
  const row = ['Ana', '5', 'valor-x'];
  const cols = buildColunasOriginais(headers, row);
  assert(cols.Nome === 'Ana', 'Nome');
  assert(cols.Nota === '5', 'Nota');
  assert(cols['Campo Extra'] === 'valor-x', 'coluna extra');
}

function testDuplicateIdOrigemInFile() {
  const buffer = buildSampleWorkbook([
    {
      Nome: 'Ana',
      'CPF/CNPJ': '123.456.789-00',
      'Id HugMe': 'H1',
      'Id Origem': 'ORIG-001',
      Título: 'Assunto 1',
      'Texto da Reclamação': 'Desc 1',
    },
    {
      Nome: 'Bob',
      'CPF/CNPJ': '987.654.321-00',
      'Id HugMe': 'H2',
      'Id Origem': 'ORIG-001',
      Título: 'Assunto 2',
      'Texto da Reclamação': 'Desc 2',
    },
  ]);

  const parsed = parseHugmeBuffer(buffer);
  assert(parsed.stats.valid === 1, 'apenas uma linha válida');
  assert(parsed.stats.duplicate === 1, 'uma duplicada intra-arquivo');
}

function testParseValidRow() {
  const buffer = buildSampleWorkbook([
    {
      Nome: 'Gustavo',
      'CPF/CNPJ': '035.509.424-00',
      'Id HugMe': '998877',
      'Id Origem': '20260700015790834',
      Título: 'Crédito Pessoal',
      'Texto da Reclamação': 'Renegociação de dívida',
      'Produto RA': 'Empréstimo',
      Nota: '8',
      Cidade: 'Vitória da Conquista',
      Estado: 'BA',
    },
  ]);

  const parsed = parseHugmeBuffer(buffer);
  assert(parsed.stats.valid === 1, 'linha válida');
  const row = parsed.rows.find((r) => r.status === 'valid');
  assert(row?.idOrigem === '20260700015790834', 'idOrigem');
  assert(row?.cpf === '03550942400', 'cpf normalizado');
  assert(row?.colunasOriginais['Nota'] === '8', 'nota em colunasOriginais');
  assert(row?.uf === 'BA', 'uf');
}

function testInvalidWithoutIdOrigem() {
  const buffer = buildSampleWorkbook([
    {
      Nome: 'Sem Id',
      'CPF/CNPJ': '111',
      'Id HugMe': 'X',
      'Id Origem': '',
      Título: 'Teste',
      'Texto da Reclamação': 'Corpo',
    },
  ]);
  const parsed = parseHugmeBuffer(buffer);
  assert(parsed.stats.invalid === 1, 'sem id origem é inválido');
}

function testEmailInboundServiceHasHugmeRoutes() {
  const fs = require('fs') as typeof import('fs');
  const indexSrc = fs.readFileSync(join(__dirname, '../src/index.ts'), 'utf8');
  assert(indexSrc.includes('/api/reclame-aqui/hugme'), 'rota hugme registrada');
  const routesSrc = fs.readFileSync(join(__dirname, '../src/routes/reclameAquiHugme.routes.ts'), 'utf8');
  assert(routesSrc.includes("'base_inicial'"), 'modo base_inicial');
  assert(routesSrc.includes('incremental'), 'modo incremental');
}

function testImportServiceRules() {
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync(join(__dirname, '../src/services/reclame-aqui/hugmeImport.service.ts'), 'utf8');
  assert(src.includes("'incremental'"), 'modo incremental');
  assert(src.includes('HugmeOrigemImportacao'), 'tipo modo importacao');
  assert(src.includes('!doc.chamadoId'), 'ticket só sem chamadoId');
}

function testSchemaUniqueIndex() {
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync(join(__dirname, '../src/models/reclamacoes/ReclameAquiHugmeRegistro.schema.ts'), 'utf8');
  assert(src.includes('idOrigem: 1'), 'índice idOrigem');
  assert(src.includes('unique: true'), 'unique index');
}

async function main() {
  testColunasOriginaisAllHeaders();
  testDuplicateIdOrigemInFile();
  testParseValidRow();
  testInvalidWithoutIdOrigem();
  testEmailInboundServiceHasHugmeRoutes();
  testImportServiceRules();
  testSchemaUniqueIndex();
  console.log('test-hugme-import-db: OK (8 checks)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
