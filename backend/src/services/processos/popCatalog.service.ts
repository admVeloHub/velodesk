/**
 * popCatalog.service v1.0.0 — catálogo de POPs (.docx) por produto, para o quadro de Processos
 * VERSION: v1.0.0 | DATE: 2026-08-14 | AUTHOR: VeloHub Development Team
 *
 * Lê "backend/source file/POPs/<produto>/<pop>.docx" e converte cada POP num JSON estruturado
 * (cabeçalho, seções, tabelas e imagens), em vez de reproduzir o texto corrido do Word.
 */
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import JSZip from 'jszip';
import { env } from '../../config/env';

export interface PopSummary {
  id: string;
  fileName: string;
  codigo: string | null;
  titulo: string | null;
  subtitulo: string | null;
  label: string;
}

export interface PopImageRef {
  id: string;
  role: 'logo' | 'fluxograma' | 'outro';
  contentType: string;
  width: number | null;
  height: number | null;
}

export type PopBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

export interface PopSection {
  id: string;
  numero: string;
  titulo: string;
  table: { headers: string[]; rows: string[][] } | null;
  blocks: PopBlock[];
}

export interface PopDetail {
  codigo: string | null;
  titulo: string | null;
  subtitulo: string | null;
  revisao: string | null;
  vigencia: string | null;
  pagina: string | null;
  campos: { label: string; valor: string }[];
  images: PopImageRef[];
  sections: PopSection[];
}

interface CacheEntry {
  mtimeMs: number;
  detail: PopDetail;
  imageBuffers: { contentType: string; buffer: Buffer }[];
}

const DOCX_EXT = /\.docx$/i;
const cache = new Map<string, CacheEntry>();

function slugify(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function isRealDocxFile(fileName: string): boolean {
  return DOCX_EXT.test(fileName) && !fileName.startsWith('~$');
}

/** Lista os produtos disponíveis (uma pasta = um produto). Exclui pastas de arquivo/legado ("OLD"). */
export function listProdutos(): { slug: string; label: string }[] {
  const root = env.popsSourceDir;
  if (!fs.existsSync(root)) return [];

  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const label = entry.name.replace(/^pop\s+/i, '').trim();
      return { slug: slugify(label), label, dirName: entry.name };
    })
    .filter((produto) => produto.label.toUpperCase() !== 'OLD')
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .map(({ slug, label }) => ({ slug, label }));
}

function resolveProdutoDir(produtoSlug: string): string | null {
  const root = env.popsSourceDir;
  if (!fs.existsSync(root)) return null;
  const match = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .find((entry) => slugify(entry.name.replace(/^pop\s+/i, '').trim()) === produtoSlug);
  return match ? path.join(root, match.name) : null;
}

function resolvePopFile(produtoSlug: string, popId: string): string | null {
  const dir = resolveProdutoDir(produtoSlug);
  if (!dir) return null;
  const match = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isRealDocxFile(entry.name))
    .find((entry) => slugify(entry.name.replace(DOCX_EXT, '')) === popId);
  return match ? path.join(dir, match.name) : null;
}

/** Lista os POPs (.docx) de um produto, com metadados leves (parse cacheado). */
export async function listPops(produtoSlug: string): Promise<PopSummary[]> {
  const dir = resolveProdutoDir(produtoSlug);
  if (!dir) return [];

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isRealDocxFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const summaries: PopSummary[] = [];
  for (const fileName of files) {
    const absPath = path.join(dir, fileName);
    try {
      const { detail } = await getOrParse(absPath);
      const id = slugify(fileName.replace(DOCX_EXT, ''));
      const label = detail.subtitulo || detail.titulo || fileName.replace(DOCX_EXT, '');
      summaries.push({
        id,
        fileName,
        codigo: detail.codigo,
        titulo: detail.titulo,
        subtitulo: detail.subtitulo,
        label,
      });
    } catch (err) {
      console.error(`[popCatalog] falha ao ler POP "${fileName}":`, err);
    }
  }
  return summaries;
}

/** Retorna o POP já estruturado (sem os bytes das imagens — ver getPopImage). */
export async function getPop(produtoSlug: string, popId: string): Promise<PopDetail | null> {
  const absPath = resolvePopFile(produtoSlug, popId);
  if (!absPath) return null;
  const { detail } = await getOrParse(absPath);
  return detail;
}

export async function getPopImage(
  produtoSlug: string,
  popId: string,
  imageId: string,
): Promise<{ contentType: string; buffer: Buffer } | null> {
  const absPath = resolvePopFile(produtoSlug, popId);
  if (!absPath) return null;
  const { imageBuffers } = await getOrParse(absPath);
  const index = Number(imageId.replace(/^img-/, ''));
  if (!Number.isInteger(index)) return null;
  return imageBuffers[index] || null;
}

async function getOrParse(absPath: string): Promise<CacheEntry> {
  const stat = fs.statSync(absPath);
  const cached = cache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;

  const entry = await parsePopDocx(absPath);
  cache.set(absPath, { ...entry, mtimeMs: stat.mtimeMs });
  return cache.get(absPath) as CacheEntry;
}

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const isPng = buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a;
  if (!isPng) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function extractMediaImages(absPath: string): Promise<{
  images: PopImageRef[];
  buffers: { contentType: string; buffer: Buffer }[];
}> {
  const zipBuffer = fs.readFileSync(absPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  const mediaNames = Object.keys(zip.files)
    .filter((name) => name.startsWith('word/media/'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const images: PopImageRef[] = [];
  const buffers: { contentType: string; buffer: Buffer }[] = [];

  for (const name of mediaNames) {
    const ext = path.extname(name).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) continue;

    const buffer = await zip.files[name].async('nodebuffer');
    const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    const dims = ext === '.png' ? pngSize(buffer) : null;

    let role: PopImageRef['role'] = 'outro';
    if (dims) {
      const ratio = dims.width / dims.height;
      if (ratio >= 2) role = 'logo';
      else role = 'fluxograma';
    }

    const index = buffers.length;
    buffers.push({ contentType, buffer });
    images.push({
      id: `img-${index}`,
      role,
      contentType,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    });
  }

  return { images, buffers };
}

function matchSectionHeader(text: string): { numero: string; titulo: string } | null {
  const m = text.trim().match(/^(\d{1,2}(?:\.\d{1,2})?)\.\s*([A-ZÀ-Ü0-9ºª°()/\- ]{3,90})$/);
  if (!m) return null;
  return { numero: m[1], titulo: m[2].trim() };
}

/**
 * Materializa a tabela HTML numa grade respeitando rowspan/colspan — o Word usa merge de
 * células com frequência nesses POPs (coluna "papel"/"sistema" repetida verticalmente etc.),
 * e ler célula-a-célula sem isso desalinha cabeçalho e dados.
 */
/** Sobe a árvore a partir de `el` até achar um ancestral com a tag informada. */
function closestAncestor($: cheerio.CheerioAPI, el: any, tagName: string): any {
  let node = $(el).parent().get(0) as any;
  while (node && node.tagName !== tagName) node = $(node).parent().get(0) as any;
  return node;
}

/** Linhas <tr> pertencentes diretamente a esta tabela (ignora tabelas aninhadas dentro de células). */
function directRows($: cheerio.CheerioAPI, table: any): any[] {
  return $(table).find('tr').toArray().filter((tr) => closestAncestor($, tr, 'table') === table);
}

/** Células <td>/<th> pertencentes diretamente a esta linha (ignora tabelas aninhadas dentro da célula). */
function directCells($: cheerio.CheerioAPI, tr: any): any[] {
  return $(tr).find('td,th').toArray().filter((cell) => closestAncestor($, cell, 'tr') === tr);
}

function tableRows($: cheerio.CheerioAPI, table: any): string[][] {
  const grid: string[][] = [];
  const rowspanCarry: { text: string; remaining: number }[] = [];
  const trs = directRows($, table);

  trs.forEach((tr: any, rowIndex: number) => {
    grid[rowIndex] = [];
    const cells = directCells($, tr);
    let cellPtr = 0;
    let colIndex = 0;

    while (cellPtr < cells.length || (rowspanCarry[colIndex] && rowspanCarry[colIndex].remaining > 0)) {
      const carry = rowspanCarry[colIndex];
      if (carry && carry.remaining > 0) {
        grid[rowIndex][colIndex] = carry.text;
        carry.remaining -= 1;
        colIndex += 1;
        continue;
      }
      if (cellPtr >= cells.length) {
        grid[rowIndex][colIndex] = '';
        colIndex += 1;
        continue;
      }
      const cell = cells[cellPtr];
      const text = $(cell).text().replace(/\s+/g, ' ').trim();
      const colspan = Math.max(1, parseInt($(cell).attr('colspan') || '1', 10));
      const rowspan = Math.max(1, parseInt($(cell).attr('rowspan') || '1', 10));
      for (let c = 0; c < colspan; c += 1) {
        grid[rowIndex][colIndex] = text;
        if (rowspan > 1) rowspanCarry[colIndex] = { text, remaining: rowspan - 1 };
        colIndex += 1;
      }
      cellPtr += 1;
    }
  });

  return grid;
}

/**
 * Corrige cabeçalhos com colunas "fantasma" (célula vazia a mais que as linhas de dados),
 * artefato comum de rowspan no cabeçalho do Word ao virar HTML — remove só do lado do header.
 */
function normalizeTable(headers: string[], rows: string[][]): { headers: string[]; rows: string[][] } {
  const dataWidth = rows[0]?.length ?? headers.length;
  if (headers.length > dataWidth) {
    const trimmed: string[] = [];
    let toDrop = headers.length - dataWidth;
    for (const h of headers) {
      if (toDrop > 0 && !h.trim()) {
        toDrop -= 1;
        continue;
      }
      trimmed.push(h);
    }
    if (trimmed.length === dataWidth) return { headers: trimmed, rows };
  }
  return { headers, rows };
}

function parseHeaderTables(rowsSets: string[][][]): {
  codigo: string | null;
  titulo: string | null;
  subtitulo: string | null;
  revisao: string | null;
  vigencia: string | null;
  pagina: string | null;
  campos: { label: string; valor: string }[];
} {
  let codigo: string | null = null;
  let titulo: string | null = null;
  let subtitulo: string | null = null;
  let revisao: string | null = null;
  let vigencia: string | null = null;
  let pagina: string | null = null;
  const campos: { label: string; valor: string }[] = [];

  for (const rows of rowsSets) {
    if (rows.length === 1 && rows[0].length === 1) {
      const raw = rows[0][0];
      const codeMatch = raw.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)+)\s*[–-]\s*(.+)$/);
      const rest = codeMatch ? codeMatch[2] : raw;
      if (codeMatch) codigo = codeMatch[1];

      const pipeParts = rest.split('|').map((part) => part.trim()).filter(Boolean);
      if (pipeParts.length >= 2) {
        titulo = pipeParts[0];
        subtitulo = pipeParts.slice(1).join(' | ');
      } else {
        const dashParts = rest.split(/\s+[–-]\s+/).map((part) => part.trim()).filter(Boolean);
        if (dashParts.length >= 2) {
          titulo = dashParts[0];
          subtitulo = dashParts.slice(1).join(' - ');
        } else {
          titulo = rest.trim() || null;
        }
      }
      continue;
    }

    if (rows.length === 2 && rows[1].length === 3 && /\d{2}\/\d{2}\/\d{4}/.test(rows[1][1] || '')) {
      [revisao, vigencia, pagina] = rows[1];
      continue;
    }

    if (rows.length === 2 && rows[0].length === rows[1].length && rows[0].length >= 2) {
      rows[0].forEach((label, i) => {
        const valor = rows[1][i] || '';
        if (label && valor) campos.push({ label, valor });
      });
    }
  }

  return { codigo, titulo, subtitulo, revisao, vigencia, pagina, campos };
}

async function parsePopDocx(absPath: string): Promise<Omit<CacheEntry, 'mtimeMs'>> {
  const { images, buffers } = await extractMediaImages(absPath);

  const buffer = fs.readFileSync(absPath);
  const result = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '' })) },
  );
  const $ = cheerio.load(result.value);
  const children = $('body').children().toArray();

  const headerRowsSets: string[][][] = [];
  const sections: PopSection[] = [];
  let current: PopSection | null = null;
  let inHeader = true;

  function startSection(header: { numero: string; titulo: string }): PopSection {
    const section: PopSection = {
      id: slugify(`${header.numero}-${header.titulo}`),
      numero: header.numero,
      titulo: header.titulo,
      table: null,
      blocks: [],
    };
    sections.push(section);
    return section;
  }

  for (const el of children) {
    const tag = (el as any).tagName;

    // A maioria dos POPs usa <p> como título de seção, mas alguns (ex.: POP-IR26-003) colocam
    // o título dentro de uma tabela de 1x1 célula só para dar destaque visual — trata os dois.
    let asSectionHeader: { numero: string; titulo: string } | null = null;
    let rows: string[][] | null = null;
    if (tag === 'table') {
      rows = tableRows($, el);
      if (rows.length === 1 && rows[0].length === 1) asSectionHeader = matchSectionHeader(rows[0][0]);
    } else if (tag === 'p') {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) asSectionHeader = matchSectionHeader(text);
    }

    if (asSectionHeader) {
      inHeader = false;
      current = startSection(asSectionHeader);
      continue;
    }

    if (inHeader) {
      if (tag === 'table' && rows) headerRowsSets.push(rows);
      continue;
    }

    if (tag === 'table') {
      if (current && rows && rows.length > 0) {
        current.table = normalizeTable(rows[0], rows.slice(1));
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = $(el).find('> li').toArray()
        .map((li: any) => $(li).text().replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (current && items.length > 0) {
        current.blocks.push({ type: 'list', ordered: tag === 'ol', items });
      }
      continue;
    }

    if (tag === 'p') {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && current) current.blocks.push({ type: 'p', text });
    }
  }

  const header = parseHeaderTables(headerRowsSets);
  if (!header.codigo) {
    const fileMatch = path.basename(absPath).match(/^(POP(?:-[A-Z0-9]+)+-\d+)/i);
    if (fileMatch) header.codigo = fileMatch[1].toUpperCase();
  }

  const detail: PopDetail = {
    ...header,
    images,
    sections,
  };

  return { detail, imageBuffers: buffers };
}
