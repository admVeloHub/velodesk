/** TelephonyRecado v2.0.0 — recados operacionais v2 para IA telefônica (LetícIA) */
import mongoose, { Document, Schema } from 'mongoose';
import type {
  TelephonyRecadoArea,
  TelephonyRecadoPolitica,
  TelephonyRecadoPrioridade,
  TelephonyRecadoTipo,
} from '../services/telephonyRecado.constants';

export type { TelephonyRecadoPrioridade } from '../services/telephonyRecado.constants';

export interface ITelephonyRecado extends Document {
  recadoId: string;
  titulo: string;
  areas: TelephonyRecadoArea[];
  tipo: TelephonyRecadoTipo;
  mensagemCliente: string;
  orientacaoAtendimento: string;
  politicaChamado: TelephonyRecadoPolitica;
  criterioChamado: string | null;
  telefonesOrigemLiberados: string[] | null;
  prioridade: TelephonyRecadoPrioridade;
  ativo: boolean;
  /** @deprecated v1 — mantido para registros legados */
  mensagem?: string;
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
    recadoId: { type: String, required: true, unique: true, trim: true, index: true },
    titulo: { type: String, required: true, trim: true },
    areas: { type: [String], default: ['geral'] },
    tipo: {
      type: String,
      enum: ['indisponibilidade', 'instabilidade', 'aviso'],
      default: 'aviso',
    },
    mensagemCliente: { type: String, default: '' },
    orientacaoAtendimento: { type: String, default: '' },
    politicaChamado: {
      type: String,
      enum: ['fluxo_normal', 'nao_abrir', 'abrir_se_persistir', 'abrir_imediatamente'],
      default: 'fluxo_normal',
    },
    criterioChamado: { type: String, default: null },
    telefonesOrigemLiberados: { type: [String], default: null },
    prioridade: {
      type: String,
      enum: ['alta', 'media', 'baixa'],
      default: 'media',
    },
    ativo: { type: Boolean, default: true, index: true },
    mensagem: { type: String },
    criadoPor: { type: String },
    atualizadoPor: { type: String },
  },
  { timestamps: true, collection: 'telephony_recados' },
);

export const TelephonyRecado = mongoose.model<ITelephonyRecado>(
  'TelephonyRecado',
  TelephonyRecadoSchema,
);
