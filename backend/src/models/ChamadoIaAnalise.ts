/**
 * ChamadoIaAnalise v1.0.0 — cache de classificação de IA por ticket (motivo/sentimento/caso grave)
 * VERSION: v1.0.0 | DATE: 2026-07-23
 *
 * Reaproveita a técnica usada no projeto wfm_atendimento (análise de IA do Octadesk): lê o
 * texto real do cliente (não a tabulação) e classifica cada ticket, guardando o resultado em
 * cache por hash de conteúdo — evita gastar tokens reclassificando um ticket cujo texto não
 * mudou, mesmo que status/tags tenham sido atualizados.
 *
 * Uso inicial (MVP): alerta precoce de "caso grave" (Bacen/Procon/Reclame Aqui/ação judicial)
 * mencionado em tickets comuns, antes de chegarem formalmente aos canais especiais. motivo e
 * sentimentoClasse já são capturados na mesma chamada (mesmo custo) para uso futuro em cards
 * complementares de "visão real do cliente".
 */
import mongoose, { Schema, Document, Types } from 'mongoose';
import type { TicketIaSourceQuality } from '../services/ticketIaAdapter.service';

export type SentimentoClasseIA = 'positivo' | 'neutro' | 'irritado' | 'confuso' | 'critico';

export interface ICasoGraveIA {
  tipo: string;
  trecho: string;
}

export interface IChamadoIaAnalise extends Document {
  chamadoId: Types.ObjectId;
  chamadoProtocolo: string;
  ticketCreatedAt: Date;
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
  corrigidoPor?: string;
  corrigidoEm?: Date;
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

const ChamadoIaAnaliseSchema = new Schema<IChamadoIaAnalise>(
  {
    chamadoId: { type: Schema.Types.ObjectId, ref: 'ChamadoN1', required: true, unique: true },
    chamadoProtocolo: { type: String, default: '' },
    ticketCreatedAt: { type: Date, required: true, default: Date.now },
    motivo: { type: String, default: '' },
    motivoNovo: { type: Boolean, default: false },
    sentimentoClasse: { type: String, default: 'neutro' },
    casoGrave: { type: CasoGraveSchema, default: null },
    textoHash: { type: String, required: true },
    qualidadeFonte: {
      type: String,
      enum: ['direto_cliente', 'resumo_atendente'],
      default: 'direto_cliente',
    },
    canal: { type: String, default: 'velodesk' },
    contextoVersao: { type: Number, default: 1 },
    modelo: { type: String, default: '' },
    origem: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    needsReanalysis: { type: Boolean, default: false },
    corrigidoPor: { type: String },
    corrigidoEm: { type: Date },
    analisadoEm: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'chamado_ia_analise' },
);

ChamadoIaAnaliseSchema.index({ 'casoGrave.tipo': 1 });
ChamadoIaAnaliseSchema.index({ analisadoEm: -1 });
ChamadoIaAnaliseSchema.index({ ticketCreatedAt: 1, motivo: 1, sentimentoClasse: 1 });

export const ChamadoIaAnalise = mongoose.model<IChamadoIaAnalise>('ChamadoIaAnalise', ChamadoIaAnaliseSchema);
