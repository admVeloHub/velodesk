/**
 * popTabulationWhitelist v1.0.0 — produtos IA restritos aos POPs indexados
 * VERSION: v1.0.0 | DATE: 2026-08-21
 */
import { listProdutos } from './popCatalog.service';
import type { TabulationActiveDto } from '../tabulation.service';

function normalizeProductKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let cachedPopLabels: string[] | null = null;

/** Labels das pastas POP (fonte filesystem / vector store). */
export function getPopProductLabels(): string[] {
  if (cachedPopLabels) return cachedPopLabels;
  cachedPopLabels = listProdutos().map((item) => item.label).filter(Boolean);
  return cachedPopLabels;
}

/** Reseta cache (testes / reload de POPs). */
export function resetPopProductLabelCache(): void {
  cachedPopLabels = null;
}

function mongoProductMatchesPop(mongoLabel: string, popLabels: string[]): boolean {
  const key = normalizeProductKey(mongoLabel);
  if (!key) return false;
  return popLabels.some((label) => {
    const popKey = normalizeProductKey(label);
    if (!popKey) return false;
    return popKey === key || popKey.includes(key) || key.includes(popKey);
  });
}

/** Produto sugerido pela IA pertence ao catálogo POP. */
export function isPopAllowedProduct(produto: unknown): boolean {
  const key = normalizeProductKey(produto);
  if (!key) return false;
  const popLabels = getPopProductLabels();
  if (!popLabels.length) return false;
  return popLabels.some((label) => {
    const popKey = normalizeProductKey(label);
    return popKey === key || popKey.includes(key) || key.includes(popKey);
  });
}

/** Intersecta tabulação Mongo com produtos presentes nas pastas POP. */
export function filterTabulationConfigToPopProducts(config: TabulationActiveDto): TabulationActiveDto {
  const popLabels = getPopProductLabels();
  if (!popLabels.length) {
    console.warn('[popTabulationWhitelist] nenhum produto POP encontrado — catálogo IA vazio');
    return { ...config, produtos: [] };
  }
  const produtos = (config.produtos || []).filter(
    (item) => item.ativo !== false && mongoProductMatchesPop(item.produto, popLabels),
  );
  if (!produtos.length) {
    console.warn('[popTabulationWhitelist] interseção Mongo/POP vazia');
  }
  return { ...config, produtos };
}
