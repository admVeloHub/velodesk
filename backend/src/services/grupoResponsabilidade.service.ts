/** grupoResponsabilidade.service v1.0.0 */
import { getGrupoResponsabilidadeModel, IGrupoResponsabilidade } from '../models/GrupoResponsabilidade';

let cachedActive: IGrupoResponsabilidade[] | null = null;

export function invalidateGrupoCache(): void {
  cachedActive = null;
}

export async function listGrupos(includeInactive = false): Promise<IGrupoResponsabilidade[]> {
  const Model = getGrupoResponsabilidadeModel();
  const filter = includeInactive ? {} : { ativo: true };
  const docs = await Model.find(filter).sort({ ordem: 1, nome: 1 }).lean();
  return docs as unknown as IGrupoResponsabilidade[];
}

export async function getActiveGrupos(): Promise<IGrupoResponsabilidade[]> {
  if (cachedActive) return cachedActive;
  cachedActive = await listGrupos(false);
  return cachedActive;
}

export async function getGrupoById(id: string): Promise<IGrupoResponsabilidade | null> {
  const Model = getGrupoResponsabilidadeModel();
  const doc = await Model.findById(id).lean();
  return doc as unknown as IGrupoResponsabilidade | null;
}

export async function createGrupo(
  payload: Partial<IGrupoResponsabilidade>,
  updatedBy: string,
): Promise<IGrupoResponsabilidade> {
  const Model = getGrupoResponsabilidadeModel();
  const slug = String(payload.slug || '').trim().toLowerCase();
  if (!slug) throw new Error('Informe o slug do grupo.');
  const exists = await Model.findOne({ slug }).select('_id').lean();
  if (exists) throw new Error('Grupo já cadastrado.');

  const doc = await Model.create({
    slug,
    nome: String(payload.nome || '').trim(),
    descricao: String(payload.descricao || '').trim(),
    ordem: payload.ordem ?? 0,
    ativo: payload.ativo !== false,
    membros: payload.membros || [],
    updatedBy,
  });
  invalidateGrupoCache();
  return doc.toObject() as IGrupoResponsabilidade;
}

export async function replaceGrupo(
  id: string,
  payload: Partial<IGrupoResponsabilidade>,
  updatedBy: string,
): Promise<IGrupoResponsabilidade | null> {
  const Model = getGrupoResponsabilidadeModel();
  const doc = await Model.findByIdAndUpdate(
    id,
    {
      slug: String(payload.slug || '').trim().toLowerCase(),
      nome: String(payload.nome || '').trim(),
      descricao: String(payload.descricao || '').trim(),
      ordem: payload.ordem ?? 0,
      ativo: payload.ativo !== false,
      membros: payload.membros || [],
      updatedBy,
    },
    { new: true, runValidators: true },
  ).lean();
  invalidateGrupoCache();
  return doc as IGrupoResponsabilidade | null;
}

export async function patchGrupo(
  id: string,
  payload: Partial<IGrupoResponsabilidade>,
  updatedBy: string,
): Promise<IGrupoResponsabilidade | null> {
  const Model = getGrupoResponsabilidadeModel();
  const patch: Record<string, unknown> = { updatedBy };
  if (payload.ativo !== undefined) patch.ativo = payload.ativo;
  if (payload.ordem !== undefined) patch.ordem = payload.ordem;
  if (payload.nome !== undefined) patch.nome = payload.nome;
  if (payload.descricao !== undefined) patch.descricao = payload.descricao;
  if (payload.membros !== undefined) patch.membros = payload.membros;

  const doc = await Model.findByIdAndUpdate(id, patch, { new: true }).lean();
  invalidateGrupoCache();
  return doc as IGrupoResponsabilidade | null;
}

export async function deleteGrupo(id: string): Promise<boolean> {
  const Model = getGrupoResponsabilidadeModel();
  const result = await Model.findByIdAndDelete(id);
  invalidateGrupoCache();
  return Boolean(result);
}

export const DEFAULT_GRUPOS = [
  { slug: 'n1', nome: 'N1', descricao: 'Atendimento N1', ordem: 0, ativo: true, membros: [{ tipo: 'perfil_desk' as const, valor: 'agent' }] },
  { slug: 'financeiro', nome: 'Financeiro', descricao: 'Equipe financeira', ordem: 1, ativo: true, membros: [] },
  { slug: 'produtos', nome: 'Produtos', descricao: 'Equipe de produtos', ordem: 2, ativo: true, membros: [] },
  { slug: 'n2', nome: 'N2', descricao: 'Suporte N2', ordem: 3, ativo: true, membros: [] },
  { slug: 'suporte', nome: 'Suporte', descricao: 'Diagnóstico técnico', ordem: 4, ativo: true, membros: [] },
];
