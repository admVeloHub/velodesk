/**
 * AgentAutonomyRule v1.0.0 — regras configuráveis de envio autônomo
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentAutonomyRule extends Document {
  enabled: boolean;
  tipo?: string;
  produto?: string;
  motivo?: string;
  detalhe?: string;
  minAuditScore: number;
  maxMessagesInThread: number;
  canais: string[];
  bloqueios: string[];
  prioridade: number;
  createdAt: Date;
  updatedAt: Date;
}

const AgentAutonomyRuleSchema = new Schema<IAgentAutonomyRule>(
  {
    enabled: { type: Boolean, default: true },
    tipo: { type: String },
    produto: { type: String },
    motivo: { type: String },
    detalhe: { type: String },
    minAuditScore: { type: Number, default: 85 },
    maxMessagesInThread: { type: Number, default: 2 },
    canais: { type: [String], default: [] },
    bloqueios: { type: [String], default: [] },
    prioridade: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'agent_autonomy_rules' },
);

export const AgentAutonomyRule = mongoose.model<IAgentAutonomyRule>(
  'AgentAutonomyRule',
  AgentAutonomyRuleSchema,
);
