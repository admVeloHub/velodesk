/** TelephonyRecado v1.0.0 — recados emergenciais para a IA telefônica consultar antes de cada ligação */
import mongoose, { Document, Schema } from 'mongoose';

export type TelephonyRecadoPrioridade = 'alta' | 'media' | 'baixa';

export interface ITelephonyRecado extends Document {
  titulo: string;
  mensagem: string;
  prioridade: TelephonyRecadoPrioridade;
  ativo: boolean;
  criadoPor?: string;
  atualizadoPor?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PRIORIDADE_ORDER: Record<TelephonyRecadoPrioridade, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

export function compareRecadoPrioridade(
  a: TelephonyRecadoPrioridade,
  b: TelephonyRecadoPrioridade,
): number {
  return PRIORIDADE_ORDER[a] - PRIORIDADE_ORDER[b];
}

const TelephonyRecadoSchema = new Schema<ITelephonyRecado>(
  {
    titulo: { type: String, required: true, trim: true },
    mensagem: { type: String, required: true, trim: true },
    prioridade: {
      type: String,
      enum: ['alta', 'media', 'baixa'],
      default: 'media',
    },
    ativo: { type: Boolean, default: true, index: true },
    criadoPor: { type: String },
    atualizadoPor: { type: String },
  },
  { timestamps: true, collection: 'telephony_recados' },
);

export const TelephonyRecado = mongoose.model<ITelephonyRecado>(
  'TelephonyRecado',
  TelephonyRecadoSchema,
);
