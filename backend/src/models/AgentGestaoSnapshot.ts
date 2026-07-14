/**
 * AgentGestaoSnapshot v1.0.0 — inventário horário de tickets ativos para Agente 3
 * VERSION: v1.0.0 | DATE: 2026-07-14
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IGestaoTicketSnapshotEntry {
  ticketId: string;
  protocolo: string;
  status: string;
  titulo: string;
  produto: string;
  motivo: string;
  responsavel: string;
  atribuido: string;
  slaBreached: boolean;
  idleHours: number;
  minutesOpen: number;
  lastInteractionAt: string;
  createdAt: string;
}

export interface IAgentGestaoSnapshot extends Document {
  snapshotAt: Date;
  ticketCount: number;
  countsByStatus: Record<string, number>;
  tickets: IGestaoTicketSnapshotEntry[];
  aggregates: Record<string, unknown>;
  llmSummary?: Record<string, unknown>;
  alertsCreated: number;
  createdAt: Date;
  updatedAt: Date;
}

const GestaoTicketSnapshotEntrySchema = new Schema<IGestaoTicketSnapshotEntry>(
  {
    ticketId: { type: String, required: true },
    protocolo: { type: String, required: true },
    status: { type: String, required: true },
    titulo: { type: String, default: '' },
    produto: { type: String, default: '' },
    motivo: { type: String, default: '' },
    responsavel: { type: String, default: '' },
    atribuido: { type: String, default: '' },
    slaBreached: { type: Boolean, default: false },
    idleHours: { type: Number, default: 0 },
    minutesOpen: { type: Number, default: 0 },
    lastInteractionAt: { type: String, default: '' },
    createdAt: { type: String, default: '' },
  },
  { _id: false },
);

const AgentGestaoSnapshotSchema = new Schema<IAgentGestaoSnapshot>(
  {
    snapshotAt: { type: Date, required: true, index: true },
    ticketCount: { type: Number, required: true },
    countsByStatus: { type: Schema.Types.Mixed, default: {} },
    tickets: { type: [GestaoTicketSnapshotEntrySchema], default: [] },
    aggregates: { type: Schema.Types.Mixed, default: {} },
    llmSummary: { type: Schema.Types.Mixed },
    alertsCreated: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'agent_gestao_snapshots' },
);

export const AgentGestaoSnapshot = mongoose.model<IAgentGestaoSnapshot>(
  'AgentGestaoSnapshot',
  AgentGestaoSnapshotSchema,
);
