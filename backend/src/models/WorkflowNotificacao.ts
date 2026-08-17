/** WorkflowNotificacao v1.1.0 — tipo 'caso_especial' (sininho sem workflow dedicado) */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export type WorkflowNotificacaoTipo = 'workflow_cta' | 'caso_especial';

export interface IWorkflowNotificacao extends Document {
  _id: Types.ObjectId;
  tipo: WorkflowNotificacaoTipo;
  destinatarioEmail: string;
  ticketId: Types.ObjectId;
  chamadoProtocolo: string;
  workflowId?: Types.ObjectId | null;
  workflowSlug: string;
  step: number;
  passoId: Types.ObjectId | null;
  orgao?: string;
  reclamacaoId?: Types.ObjectId | null;
  titulo: string;
  mensagem: string;
  lida: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowNotificacaoSchema = new Schema<IWorkflowNotificacao>(
  {
    tipo: { type: String, enum: ['workflow_cta', 'caso_especial'], default: 'workflow_cta' },
    destinatarioEmail: { type: String, required: true, index: true },
    ticketId: { type: Schema.Types.ObjectId, required: true, index: true },
    chamadoProtocolo: { type: String, default: '' },
    workflowId: { type: Schema.Types.ObjectId, default: null },
    workflowSlug: { type: String, default: '' },
    step: { type: Number, default: 0 },
    passoId: { type: Schema.Types.ObjectId, default: null },
    orgao: { type: String, default: '' },
    reclamacaoId: { type: Schema.Types.ObjectId, default: null },
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
