/** WorkflowNotificacao v1.0.0 — CTA workflow persistido (sininho + Painel 360) */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IWorkflowNotificacao extends Document {
  _id: Types.ObjectId;
  destinatarioEmail: string;
  ticketId: Types.ObjectId;
  chamadoProtocolo: string;
  workflowId: Types.ObjectId;
  workflowSlug: string;
  step: number;
  passoId: Types.ObjectId | null;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowNotificacaoSchema = new Schema<IWorkflowNotificacao>(
  {
    destinatarioEmail: { type: String, required: true, index: true },
    ticketId: { type: Schema.Types.ObjectId, required: true, index: true },
    chamadoProtocolo: { type: String, default: '' },
    workflowId: { type: Schema.Types.ObjectId, required: true },
    workflowSlug: { type: String, default: '' },
    step: { type: Number, default: 0 },
    passoId: { type: Schema.Types.ObjectId, default: null },
    titulo: { type: String, default: '' },
    mensagem: { type: String, default: '' },
    lida: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'workflow_notificacoes',
  },
);

WorkflowNotificacaoSchema.index({ destinatarioEmail: 1, lida: 1, createdAt: -1 });

export function getWorkflowNotificacaoModel(): Model<IWorkflowNotificacao> {
  const conn = getDeskConfigConnection();
  if (conn.models.WorkflowNotificacao) {
    return conn.models.WorkflowNotificacao as Model<IWorkflowNotificacao>;
  }
  return conn.model<IWorkflowNotificacao>('WorkflowNotificacao', WorkflowNotificacaoSchema);
}
