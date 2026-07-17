/** workflowNotificacao.service v1.0.0 — CTA persistido para sininho e Painel 360 */
import { Types } from 'mongoose';
import { getWorkflowNotificacaoModel, IWorkflowNotificacao } from '../models/WorkflowNotificacao';

export async function createWorkflowNotificacao(payload: {
  destinatarioEmail: string;
  ticketId: string;
  chamadoProtocolo?: string;
  workflowId: string;
  workflowSlug?: string;
  step: number;
  passoId?: string | null;
  titulo: string;
  mensagem: string;
}): Promise<IWorkflowNotificacao> {
  const Model = getWorkflowNotificacaoModel();
  const doc = await Model.create({
    destinatarioEmail: String(payload.destinatarioEmail).trim().toLowerCase(),
    ticketId: new Types.ObjectId(payload.ticketId),
    chamadoProtocolo: payload.chamadoProtocolo || '',
    workflowId: new Types.ObjectId(payload.workflowId),
    workflowSlug: payload.workflowSlug || '',
    step: payload.step,
    passoId: payload.passoId ? new Types.ObjectId(payload.passoId) : null,
    titulo: payload.titulo || 'Ação necessária',
    mensagem: payload.mensagem || '',
    lida: false,
  });
  return doc.toObject() as IWorkflowNotificacao;
}

export async function listUnreadNotificacoes(email: string) {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];
  return Model.find({ destinatarioEmail: normalized, lida: false })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
}

export async function listNotificacoesForUser(email: string, limit = 30) {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];
  return Model.find({ destinatarioEmail: normalized })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

export async function markNotificacaoLida(id: string, email: string): Promise<boolean> {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  const result = await Model.findOneAndUpdate(
    { _id: id, destinatarioEmail: normalized },
    { lida: true },
    { new: true },
  );
  return Boolean(result);
}

export async function markNotificacoesLidasForTicket(ticketId: string, email: string): Promise<number> {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  const result = await Model.updateMany(
    { ticketId: new Types.ObjectId(ticketId), destinatarioEmail: normalized, lida: false },
    { lida: true },
  );
  return result.modifiedCount ?? 0;
}

export async function countUnreadNotificacoes(email: string): Promise<number> {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return 0;
  return Model.countDocuments({ destinatarioEmail: normalized, lida: false });
}

export async function listCtaTicketsForUser(email: string): Promise<string[]> {
  const Model = getWorkflowNotificacaoModel();
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];
  const rows = await Model.find({ destinatarioEmail: normalized, lida: false })
    .select('ticketId')
    .lean();
  return [...new Set(rows.map((r) => String(r.ticketId)))];
}
