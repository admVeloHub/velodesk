/** tabulation.service v1.2.2 — agregação e cascata produto → motivo → detalhe */
import type { ITabulacaoDetalhe, ITabulacaoMotivo, ITabulacaoProduto } from '../models/TabulacaoProduto';
import { getTabulacaoProdutoModel } from '../models/TabulacaoProduto';

export interface TabulationProdutoDto {
  _id: string;
  produto: string;
  ordem: number;
  ativo: boolean;
  motivos: ITabulacaoMotivo[];
}

export interface TabulationActiveDto {
  produtos: TabulationProdutoDto[];
}

let cachedActive: TabulationActiveDto | null = null;

export function invalidateTabulationCache(): void {
  cachedActive = null;
}

function sortByOrdem<T extends { ordem: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.ordem - b.ordem);
}

function normalizeDetalhe(d: ITabulacaoDetalhe): ITabulacaoDetalhe {
  return {
    detalhe: d.detalhe,
    ordem: d.ordem ?? 0,
    ativo: d.ativo !== false,
  };
}

function normalizeMotivos(motivos: ITabulacaoMotivo[]): ITabulacaoMotivo[] {
  return sortByOrdem(motivos).map((m) => ({
    motivo: m.motivo,
    ordem: m.ordem ?? 0,
    ativo: m.ativo !== false,
    detalhes: sortByOrdem(m.detalhes || []).map(normalizeDetalhe),
  }));
}

function produtoToDto(doc: ITabulacaoProduto): TabulationProdutoDto {
  return {
    _id: doc._id.toString(),
    produto: doc.produto,
    ordem: doc.ordem,
    ativo: doc.ativo,
    motivos: normalizeMotivos(doc.motivos || []),
  };
}

export async function listProdutos(includeInactive = true): Promise<TabulationProdutoDto[]> {
  const Model = getTabulacaoProdutoModel();
  const filter = includeInactive ? {} : { ativo: true };
  const docs = await Model.find(filter).sort({ ordem: 1, produto: 1 });
  return docs.map(produtoToDto);
}

export async function getProdutoById(id: string): Promise<TabulationProdutoDto | null> {
  const Model = getTabulacaoProdutoModel();
  const doc = await Model.findById(id);
  return doc ? produtoToDto(doc) : null;
}

export async function getActiveTabulation(): Promise<TabulationActiveDto> {
  if (cachedActive) return cachedActive;
  const produtos = await listProdutos(false);
  cachedActive = { produtos };
  return cachedActive;
}

export async function createProduto(
  body: { produto: string; ordem?: number; ativo?: boolean; motivos?: ITabulacaoMotivo[] },
  updatedBy: string
): Promise<TabulationProdutoDto> {
  const Model = getTabulacaoProdutoModel();
  const produto = String(body.produto || '').trim();
  if (!produto) throw new Error('Nome do produto é obrigatório');

  const existing = await Model.findOne({ produto });
  if (existing) throw new Error('Produto já cadastrado');

  let ordem = body.ordem;
  if (ordem === undefined) {
    const last = await Model.findOne().sort({ ordem: -1 }).select('ordem').lean();
    ordem = ((last as { ordem?: number } | null)?.ordem ?? -1) + 1;
  }

  const doc = await Model.create({
    produto,
    ordem,
    ativo: body.ativo !== false,
    motivos: normalizeMotivos(body.motivos || []),
    updatedBy,
  });
  invalidateTabulationCache();
  return produtoToDto(doc);
}

export async function replaceProduto(
  id: string,
  body: { produto?: string; ordem?: number; ativo?: boolean; motivos?: ITabulacaoMotivo[] },
  updatedBy: string
): Promise<TabulationProdutoDto | null> {
  const Model = getTabulacaoProdutoModel();
  const doc = await Model.findById(id);
  if (!doc) return null;

  if (body.produto !== undefined) {
    const produto = String(body.produto).trim();
    if (!produto) throw new Error('Nome do produto é obrigatório');
    const dup = await Model.findOne({ produto, _id: { $ne: id } });
    if (dup) throw new Error('Produto já cadastrado');
    doc.produto = produto;
  }
  if (body.ordem !== undefined) doc.ordem = body.ordem;
  if (body.ativo !== undefined) doc.ativo = body.ativo;
  if (body.motivos !== undefined) doc.motivos = normalizeMotivos(body.motivos);
  doc.updatedBy = updatedBy;

  await doc.save();
  invalidateTabulationCache();
  return produtoToDto(doc);
}

export async function patchProduto(
  id: string,
  body: { produto?: string; ordem?: number; ativo?: boolean },
  updatedBy: string
): Promise<TabulationProdutoDto | null> {
  return replaceProduto(id, body, updatedBy);
}

export async function deleteProduto(id: string): Promise<boolean> {
  const Model = getTabulacaoProdutoModel();
  const result = await Model.findByIdAndDelete(id);
  if (result) invalidateTabulationCache();
  return Boolean(result);
}

export function validateComboSoft(
  config: TabulationActiveDto,
  produto: string,
  motivo: string,
  detalhe: string
): boolean {
  if (!produto) return true;
  const p = config.produtos.find((item) => item.produto === produto && item.ativo);
  if (!p) return false;
  if (!motivo) return true;
  const m = p.motivos.find((item) => item.motivo === motivo && item.ativo);
  if (!m) return false;
  if (!detalhe) return true;
  return (m.detalhes || []).some((item) => item.detalhe === detalhe && item.ativo);
}

export const DEFAULT_TABULACAO_PRODUTOS: Array<{
  produto: string;
  ordem: number;
  motivos: ITabulacaoMotivo[];
}> = [
  {
    produto: 'Internet Fibra',
    ordem: 0,
    motivos: [
      {
        motivo: 'Lentidão',
        ordem: 0,
        ativo: true,
        detalhes: [
          { detalhe: 'Em análise', ordem: 0, ativo: true },
          { detalhe: 'Aguardando técnico', ordem: 1, ativo: true },
        ],
      },
      {
        motivo: 'Queda de sinal',
        ordem: 1,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
      {
        motivo: 'Sem conexão',
        ordem: 2,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
    ],
  },
  {
    produto: 'TV',
    ordem: 1,
    motivos: [
      {
        motivo: 'Cancelamento',
        ordem: 0,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
      {
        motivo: 'Cobrança',
        ordem: 1,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
    ],
  },
  {
    produto: 'Telefone',
    ordem: 2,
    motivos: [
      {
        motivo: 'Financeiro',
        ordem: 0,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
    ],
  },
  {
    produto: 'Combo',
    ordem: 3,
    motivos: [
      {
        motivo: 'Cancelamento',
        ordem: 0,
        ativo: true,
        detalhes: [{ detalhe: 'Em análise', ordem: 0, ativo: true }],
      },
    ],
  },
];
