/**
 * AgentGestaoAlert v1.0.0 — alertas do agente de gestão de chamados
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentGestaoAlert extends Document {
  tipo: string;
  severidade: string;
  protocolo?: string;
  ticketId?: string;
  resumo: string;
  detalhes?: Record<string, unknown>;
  lido: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AgentGestaoAlertSchema = new Schema<IAgentGestaoAlert>(
  {
    tipo: { type: String, required: true },
    severidade: { type: String, required: true },
    protocolo: { type: String },
    ticketId: { type: String },
    resumo: { type: String, required: true },
    detalhes: { type: Schema.Types.Mixed },
    lido: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'agent_gestao_alerts' },
);

export const AgentGestaoAlert = mongoose.model<IAgentGestaoAlert>(
  'AgentGestaoAlert',
  AgentGestaoAlertSchema,
);
