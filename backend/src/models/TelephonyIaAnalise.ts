/**
 * TelephonyIaAnalise v1.0.0 — cache de classificação IA por ligação Letícia IA (Contact Tel)
 */
import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ICasoGraveIA, SentimentoClasseIA } from './ChamadoIaAnalise';
import type { TicketIaSourceQuality } from '../services/ticketIaAdapter.service';

export interface ITelephonyIaAnalise extends Document {
  telephonyCallId: Types.ObjectId;
  externalCallId: string;
  callEndedAt: Date;
  motivo: string;
  motivoNovo: boolean;
  sentimentoClasse: SentimentoClasseIA | string;
  casoGrave: ICasoGraveIA | null;
  textoHash: string;
  qualidadeFonte: TicketIaSourceQuality;
  canal: string;
  contextoVersao: number;
  modelo: string;
  origem: 'auto' | 'manual';
  needsReanalysis: boolean;
  analisadoEm: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CasoGraveSchema = new Schema<ICasoGraveIA>(
  {
    tipo: { type: String, required: true },
    trecho: { type: String, default: '' },
  },
  { _id: false },
);

const TelephonyIaAnaliseSchema = new Schema<ITelephonyIaAnalise>(
  {
    telephonyCallId: { type: Schema.Types.ObjectId, ref: 'TelephonyCall', required: true, unique: true },
    externalCallId: { type: String, default: '', index: true },
    callEndedAt: { type: Date, required: true, default: Date.now },
    motivo: { type: String, default: '' },
    motivoNovo: { type: Boolean, default: false },
    sentimentoClasse: { type: String, default: 'neutro' },
    casoGrave: { type: CasoGraveSchema, default: null },
    textoHash: { type: String, required: true },
    qualidadeFonte: {
      type: String,
      enum: ['direto_cliente', 'resumo_atendente'],
      default: 'resumo_atendente',
    },
    canal: { type: String, default: 'leticia-ia' },
    contextoVersao: { type: Number, default: 1 },
    modelo: { type: String, default: '' },
    origem: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    needsReanalysis: { type: Boolean, default: false },
    analisadoEm: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'telephony_ia_analise' },
);

TelephonyIaAnaliseSchema.index({ analisadoEm: -1 });
TelephonyIaAnaliseSchema.index({ callEndedAt: 1, motivo: 1 });

export const TelephonyIaAnalise = mongoose.model<ITelephonyIaAnalise>(
  'TelephonyIaAnalise',
  TelephonyIaAnaliseSchema,
);
