/**
 * boxesCache.service v1.0.0 — cache TTL curto da lista de boxes (mudam raramente).
 *
 * As boxes são lidas ~15x por requisição no fluxo de tickets (resolução de fila para cada ticket).
 * Como o conteúdo é estável, um cache curto elimina dezenas de `Box.find()` idênticos por segundo
 * sob carga, sem risco de inconsistência relevante (TTL baixo) e sem alterar schema/uso.
 * Consumo é somente leitura (nome/_id), então usamos `.lean()`.
 */
import { Box } from '../models/Box';

interface CachedBox {
  _id: import('mongoose').Types.ObjectId;
  name: string;
  order: number;
}

const TTL_MS = 15_000;
let cache: CachedBox[] | null = null;
let cachedAt = 0;
let inflight: Promise<CachedBox[]> | null = null;

export async function getCachedBoxes(): Promise<CachedBox[]> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = Box.find()
    .sort({ order: 1 })
    .lean<CachedBox[]>()
    .then((docs) => {
      cache = docs;
      cachedAt = Date.now();
      inflight = null;
      return docs;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });

  return inflight;
}

/** Zera o cache (chame após criar/editar/remover boxes). */
export function invalidateBoxesCache(): void {
  cache = null;
  cachedAt = 0;
}
