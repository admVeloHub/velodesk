/** workflowDefinicao.service v1.1.0 */
import { Types } from 'mongoose';
import {
  getWorkflowDefinicaoModel,
  IWorkflowDefinicao,
  IWorkflowPassoEnvelope,
} from '../models/WorkflowDefinicao';
import { evaluateGatilhoCriterios, buildTabulationFieldsFromTicket } from './workflowMatcher.service';
import { getActiveGrupos } from './grupoResponsabilidade.service';

let cachedActive: IWorkflowDefinicao[] | null = null;

export function invalidateWorkflowCache(): void {
  cachedActive = null;
}

function sortPassos(passos: IWorkflowPassoEnvelope[] = []): IWorkflowPassoEnvelope[] {
  return [...passos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function ensurePassoIds(passos: IWorkflowPassoEnvelope[] = []): IWorkflowPassoEnvelope[] {
  return sortPassos(passos).map((envelope, index) => ({
    ...envelope,
    ordem: index,
    _id: envelope._id ? new Types.ObjectId(String(envelope._id)) : new Types.ObjectId(),
  }));
}

function normalizePassoInicialId(
  passos: IWorkflowPassoEnvelope[],
  passoInicialId?: Types.ObjectId | string | null,
): Types.ObjectId | null {
  const sorted = sortPassos(passos);
  if (passoInicialId) {
    const found = sorted.find((p) => String(p._id) === String(passoInicialId));
    if (found?._id) return found._id as Types.ObjectId;
  }
  return (sorted[0]?._id as Types.ObjectId) || null;
}

export async function listWorkflows(includeInactive = false): Promise<IWorkflowDefinicao[]> {
  const Model = getWorkflowDefinicaoModel();
  const filter = includeInactive ? {} : { ativo: true };
  const docs = await Model.find(filter).sort({ ordem: 1, titulo: 1 }).lean();
  return docs as unknown as IWorkflowDefinicao[];
}

export async function getActiveWorkflows(): Promise<IWorkflowDefinicao[]> {
  if (cachedActive) return cachedActive;
  cachedActive = await listWorkflows(false);
  return cachedActive;
}

export async function getWorkflowById(id: string): Promise<IWorkflowDefinicao | null> {
  const Model = getWorkflowDefinicaoModel();
  return Model.findById(id).lean() as Promise<IWorkflowDefinicao | null>;
}

export async function getWorkflowBySlug(slug: string): Promise<IWorkflowDefinicao | null> {
  const Model = getWorkflowDefinicaoModel();
  return Model.findOne({ slug: String(slug).trim().toLowerCase() }).lean() as Promise<IWorkflowDefinicao | null>;
}

export async function createWorkflow(
  payload: Partial<IWorkflowDefinicao>,
  updatedBy: string,
): Promise<IWorkflowDefinicao> {
  const Model = getWorkflowDefinicaoModel();
  const slug = String(payload.slug || '').trim().toLowerCase();
  if (!slug) throw new Error('Informe o slug do workflow.');
  const exists = await Model.findOne({ slug }).select('_id').lean();
  if (exists) throw new Error('Workflow já cadastrado.');

  const passos = ensurePassoIds(payload.passos || []);
  const passoInicialId = normalizePassoInicialId(passos, payload.passoInicialId);

  const doc = await Model.create({
    slug,
    titulo: String(payload.titulo || '').trim(),
    descricao: String(payload.descricao || '').trim(),
    ordem: payload.ordem ?? 0,
    ativo: payload.ativo !== false,
    gatilho: payload.gatilho || { tipo: 'tabulacao', descricao: '', criterios: [] },
    passos,
    passoInicialId,
    updatedBy,
  });
  invalidateWorkflowCache();
  return doc.toObject() as IWorkflowDefinicao;
}

export async function replaceWorkflow(
  id: string,
  payload: Partial<IWorkflowDefinicao>,
  updatedBy: string,
): Promise<IWorkflowDefinicao | null> {
  const Model = getWorkflowDefinicaoModel();
  const passos = ensurePassoIds(payload.passos || []);
  const passoInicialId = normalizePassoInicialId(passos, payload.passoInicialId);

  const doc = await Model.findByIdAndUpdate(
    id,
    {
      slug: String(payload.slug || '').trim().toLowerCase(),
      titulo: String(payload.titulo || '').trim(),
      descricao: String(payload.descricao || '').trim(),
      ordem: payload.ordem ?? 0,
      ativo: payload.ativo !== false,
      gatilho: payload.gatilho || { tipo: 'tabulacao', descricao: '', criterios: [] },
      passos,
      passoInicialId,
      updatedBy,
    },
    { new: true, runValidators: true },
  ).lean();
  invalidateWorkflowCache();
  return doc as IWorkflowDefinicao | null;
}

export async function patchWorkflow(
  id: string,
  payload: Partial<IWorkflowDefinicao>,
  updatedBy: string,
): Promise<IWorkflowDefinicao | null> {
  const Model = getWorkflowDefinicaoModel();
  const patch: Record<string, unknown> = { updatedBy };
  if (payload.ativo !== undefined) patch.ativo = payload.ativo;
  if (payload.ordem !== undefined) patch.ordem = payload.ordem;
  if (payload.titulo !== undefined) patch.titulo = payload.titulo;
  if (payload.descricao !== undefined) patch.descricao = payload.descricao;

  const doc = await Model.findByIdAndUpdate(id, patch, { new: true }).lean();
  invalidateWorkflowCache();
  return doc as IWorkflowDefinicao | null;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const Model = getWorkflowDefinicaoModel();
  const result = await Model.findByIdAndDelete(id);
  invalidateWorkflowCache();
  return Boolean(result);
}

export async function resolveWorkflowForTicket(ticket: {
  tabulacao?: Array<Record<string, string>>;
  lateralForm?: Record<string, string>;
}): Promise<IWorkflowDefinicao | null> {
  const fields = buildTabulationFieldsFromTicket(ticket);
  const grupos = await getActiveGrupos();
  const workflows = await getActiveWorkflows();

  return workflows.find((wf) => evaluateGatilhoCriterios(wf.gatilho?.criterios || [], fields, grupos)) || null;
}
