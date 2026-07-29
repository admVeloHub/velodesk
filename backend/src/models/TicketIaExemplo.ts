/** TicketIaExemplo v1.0.0 — exemplos confirmados usados como few-shot */
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITicketIaExemplo extends Document {
  chamadoId?: Types.ObjectId;
  protocolo?: string;
  titulo: string;
  trecho: string;
  motivo: string;
  confirmadoPor?: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TicketIaExemploSchema = new Schema<ITicketIaExemplo>(
  {
    chamadoId: { type: Schema.Types.ObjectId, ref: 'ChamadoN1' },
    protocolo: { type: String },
    titulo: { type: String, default: '' },
    trecho: { type: String, required: true },
    motivo: { type: String, required: true, index: true },
    confirmadoPor: { type: String },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'ticket_ia_exemplos' },
);

TicketIaExemploSchema.index({ chamadoId: 1, motivo: 1 }, { unique: true, sparse: true });

export const TicketIaExemplo = mongoose.model<ITicketIaExemplo>(
  'TicketIaExemplo',
  TicketIaExemploSchema,
);
