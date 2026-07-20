/** funcaoPermissao.service v1.0.0 — CRUD desk_funcoes_permissoes + seed */
import {
  DEFAULT_FUNCOES_PERMISSOES,
  PERMISSION_CATALOG,
  type PermissoesMap,
} from '../config/funcaoPermissaoDefaults';
import {
  getDeskFuncaoPermissaoModel,
  IDeskFuncaoPermissao,
} from '../models/DeskFuncaoPermissao';

let cachedFuncoes: IDeskFuncaoPermissao[] | null = null;

export function invalidateFuncaoPermissaoCache(): void {
  cachedFuncoes = null;
}

function mergePermissoes(base: PermissoesMap, patch: PermissoesMap): PermissoesMap {
  const result: PermissoesMap = JSON.parse(JSON.stringify(base || {}));
  for (const [modulo, subs] of Object.entries(patch || {})) {
    if (!result[modulo]) result[modulo] = {};
    for (const [key, val] of Object.entries(subs || {})) {
      if (typeof val === 'boolean') result[modulo][key] = val;
    }
  }
  return result;
}

function buildEmptyPermissoes(): PermissoesMap {
  const empty: PermissoesMap = {};
  for (const [modulo, keys] of Object.entries(PERMISSION_CATALOG)) {
    empty[modulo] = {};
    for (const key of keys) empty[modulo][key] = false;
  }
  return empty;
}

export function resolveEffectivePermissoes(
  doc: Pick<IDeskFuncaoPermissao, 'slug' | 'herdaDe' | 'permissoes'>,
  allBySlug: Map<string, IDeskFuncaoPermissao>,
  visiting = new Set<string>(),
): PermissoesMap {
  if (visiting.has(doc.slug)) return buildEmptyPermissoes();
  visiting.add(doc.slug);

  let merged = buildEmptyPermissoes();

  for (const parentSlug of doc.herdaDe || []) {
    const parent = allBySlug.get(parentSlug);
    if (!parent) continue;
    const parentEffective = resolveEffectivePermissoes(parent, allBySlug, new Set(visiting));
    merged = mergePermissoes(merged, parentEffective);
  }

  merged = mergePermissoes(merged, doc.permissoes || {});
  return merged;
}

export async function listFuncoesPermissoes(force = false): Promise<IDeskFuncaoPermissao[]> {
  if (cachedFuncoes && !force) return cachedFuncoes;
  const Model = getDeskFuncaoPermissaoModel();
  cachedFuncoes = await Model.find().sort({ nivel: 1, slug: 1 }).lean() as unknown as IDeskFuncaoPermissao[];
  return cachedFuncoes;
}

export async function getFuncaoBySlug(slug: string): Promise<IDeskFuncaoPermissao | null> {
  const all = await listFuncoesPermissoes();
  return all.find((f) => f.slug === slug) || null;
}

export async function getEffectivePermissionsForSlug(slug: string): Promise<{
  slug: string;
  permissoes: PermissoesMap;
  portalVisivel: string[];
  nivel: number;
  canalOrigem?: string;
} | null> {
  const all = await listFuncoesPermissoes();
  const map = new Map(all.map((f) => [f.slug, f]));
  const doc = map.get(slug);
  if (!doc) return null;

  return {
    slug: doc.slug,
    permissoes: resolveEffectivePermissoes(doc, map),
    portalVisivel: doc.portalVisivel || ['agent'],
    nivel: doc.nivel ?? 1,
    canalOrigem: doc.canalOrigem || undefined,
  };
}

export async function seedFuncoesPermissoes(): Promise<void> {
  const Model = getDeskFuncaoPermissaoModel();
  const count = await Model.countDocuments();
  if (count > 0) return;

  await Model.insertMany(
    DEFAULT_FUNCOES_PERMISSOES.map((item) => ({
      ...item,
      updatedBy: 'seed',
    })),
  );
  invalidateFuncaoPermissaoCache();
  console.log(`Seed: ${DEFAULT_FUNCOES_PERMISSOES.length} função(ões) de permissão Desk criadas`);
}

export async function replaceFuncaoPermissao(
  slug: string,
  payload: Partial<IDeskFuncaoPermissao>,
  updatedBy: string,
): Promise<IDeskFuncaoPermissao | null> {
  const Model = getDeskFuncaoPermissaoModel();
  const $set: Record<string, unknown> = { updatedBy };
  if (payload.nome !== undefined) $set.nome = payload.nome;
  if (payload.nivel !== undefined) $set.nivel = payload.nivel;
  if (payload.herdaDe !== undefined) $set.herdaDe = payload.herdaDe;
  if (payload.portalVisivel !== undefined) $set.portalVisivel = payload.portalVisivel;
  if (payload.canalOrigem !== undefined) $set.canalOrigem = payload.canalOrigem;
  if (payload.permissoes !== undefined) $set.permissoes = payload.permissoes;

  const $setOnInsert: Record<string, unknown> = {
    slug,
    nome: payload.nome || slug,
    nivel: payload.nivel ?? 1,
    herdaDe: payload.herdaDe ?? [],
    portalVisivel: payload.portalVisivel ?? ['agent'],
    permissoes: payload.permissoes ?? buildEmptyPermissoes(),
  };

  // MongoDB rejects the same path in both $set and $setOnInsert.
  for (const key of Object.keys($set)) {
    delete $setOnInsert[key];
  }

  const doc = await Model.findOneAndUpdate(
    { slug },
    { $set, $setOnInsert },
    { new: true, upsert: true, runValidators: true },
  ).lean();
  invalidateFuncaoPermissaoCache();
  return doc as unknown as IDeskFuncaoPermissao | null;
}

export function getNivelMap(funcoes: IDeskFuncaoPermissao[]): Map<string, number> {
  return new Map(funcoes.map((f) => [f.slug, f.nivel ?? 1]));
}

export function getPermissionCatalog() {
  return PERMISSION_CATALOG;
}
