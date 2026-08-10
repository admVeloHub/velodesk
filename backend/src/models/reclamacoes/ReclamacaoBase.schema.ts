/** ReclamacaoBase.schema v1.0.0 — schema compartilhado chamados_reclamacoes */
import { Schema, Document, Types } from 'mongoose';
import type { CasoEspecialOrgao } from '../../services/agents/casosEspeciais.types';

export interface IReclamacaoTriagem {
  classificacao: string;
  orgao: string;
  confianca: string;
  evidencia: string;
  justificativa: string;
  signals: string[];
  at: Date;
  agenteVersao: string;
}

export interface IReclamacao extends Document {
  orgao: CasoEspecialOrgao;
  chamadoId: Types.ObjectId;
  chamadoProtocolo: string;
  origemEntrada: string;
  inboxDedicada: boolean;
  emailThreadRootId?: string;
  triagem?: IReclamacaoTriagem;
  consumidor: string;
  cpf?: string;
  email?: string[];
  telefoneWhatsapp?: string;
  assunto: string;
  descricao: string;
  produto?: string;
  tipo?: string;
  motivo?: string;
  statusCanal: string;
  prazoLegal?: Date;
  slaPct?: number;
  orgaoInstituicao?: string;
  cidade?: string;
  uf?: string;
  protocoloExterno?: string;
  idDemandaExterna?: string;
  atendente?: string;
  responsavel?: string;
  workflowId?: Types.ObjectId;
  workflowSlug?: string;
  workflowAtivo: boolean;
  aberta: boolean;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ReclamacaoTriagemSchema = new Schema<IReclamacaoTriagem>(
  {
    classificacao: { type: String, required: true },
    orgao: { type: String, required: true },
    confianca: { type: String, required: true },
    evidencia: { type: String, default: '' },
    justificativa: { type: String, default: '' },
    signals: { type: [String], default: [] },
    at: { type: Date, required: true },
    agenteVersao: { type: String, default: 'casosEspeciaisAgent v1.0.0' },
  },
  { _id: false },
);

export const ReclamacaoBaseSchema = new Schema<IReclamacao>(
  {
    orgao: { type: String, required: true },
    chamadoId: { type: Schema.Types.ObjectId, required: true, ref: 'ChamadoN1' },
    chamadoProtocolo: { type: String, default: '' },
    origemEntrada: { type: String, default: '' },
    inboxDedicada: { type: Boolean, default: false },
    emailThreadRootId: { type: String, default: '' },
    triagem: { type: ReclamacaoTriagemSchema, default: undefined },
    consumidor: { type: String, default: '' },
    cpf: { type: String, default: '' },
    email: { type: [String], default: [] },
    telefoneWhatsapp: { type: String, default: '' },
    assunto: { type: String, default: '' },
    descricao: { type: String, default: '' },
    produto: { type: String, default: '' },
    tipo: { type: String, default: '' },
    motivo: { type: String, default: '' },
    statusCanal: { type: String, default: 'nao-respondida' },
    prazoLegal: { type: Date, default: undefined },
    slaPct: { type: Number, default: undefined },
    orgaoInstituicao: { type: String, default: '' },
    cidade: { type: String, default: '' },
    uf: { type: String, default: '' },
    protocoloExterno: { type: String, default: '' },
    idDemandaExterna: { type: String, default: '' },
    atendente: { type: String, default: '' },
    responsavel: { type: String, default: '' },
    workflowId: { type: Schema.Types.ObjectId, default: undefined },
    workflowSlug: { type: String, default: '' },
    workflowAtivo: { type: Boolean, default: false },
    aberta: { type: Boolean, default: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

ReclamacaoBaseSchema.index({ chamadoId: 1 }, { unique: true, name: 'chamadoId_1' });
ReclamacaoBaseSchema.index({ chamadoProtocolo: 1 }, { name: 'chamadoProtocolo_1' });
ReclamacaoBaseSchema.index({ statusCanal: 1, prazoLegal: 1 }, { name: 'statusCanal_prazoLegal_1' });
ReclamacaoBaseSchema.index({ cpf: 1 }, { name: 'cpf_1', sparse: true });
ReclamacaoBaseSchema.index({ aberta: 1, createdAt: -1 }, { name: 'aberta_createdAt_1' });
