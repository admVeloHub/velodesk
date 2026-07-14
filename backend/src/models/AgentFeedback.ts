/**
 * AgentFeedback v1.0.0 — feedback para aprendizado dos agentes IA
 * VERSION: v1.0.0 | DATE: 2026-07-13
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentFeedback extends Document {
  ticketId?: string;
  protocolo?: string;
  agentOrigem: 'atendimento' | 'auditoria';
  tipoEvento: 'revisao_automatica' | 'revisao_solicitada' | 'bloqueio_critico' | 'envio_autonomo';
  scoreAntes?: number;
  scoreDepois?: number;
  violacoes: string[];
  inputOperador?: string;
  respostaAntes?: string;
  respostaDepois?: string;
  tabulacao?: Record<string, unknown>;
  produto?: string;
  motivo?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AgentFeedbackSchema = new Schema<IAgentFeedback>(
  {
    ticketId: { type: String },
    protocolo: { type: String },
    agentOrigem: { type: String, required: true },
    tipoEvento: { type: String, required: true },
    scoreAntes: { type: Number },
    scoreDepois: { type: Number },
    violacoes: { type: [String], default: [] },
    inputOperador: { type: String },
    respostaAntes: { type: String },
    respostaDepois: { type: String },
    tabulacao: { type: Schema.Types.Mixed },
    produto: { type: String },
    motivo: { type: String },
  },
  { timestamps: true, collection: 'agent_feedback' },
);

export const AgentFeedback = mongoose.model<IAgentFeedback>('AgentFeedback', AgentFeedbackSchema);
