/** ReclamacaoBase.schema v1.3.0 — índice unique esparso em idDemandaExterna */
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

export interface IReclamacaoWorkflowRequisicao {
  preenchidaEm?: Date;
  preenchidaPor?: string;
  valores?: Record<string, unknown>;
  comunicacaoWorkflow?: Array<{ mensagem: string; data: Date; autor: string }>;
}

/**
 * Espelha IChamadoWorkflow (ChamadoN1.ts) — o ticket permanece elegível a qualquer workflow
 * real (não um "*-tratativa" dedicado ao órgão); este bloco é o snapshot denormalizado do
 * workflow ativo no ticket, para consulta/ação direto do dash do órgão sem join em chamados_n1.
 */
export interface IReclamacaoWorkflow {
  active: boolean;
  workflowStatus?: 'active' | 'finished' | null;
  workflowId: Types.ObjectId | null;
  step: number;
  passoId: Types.ObjectId | null;
  startedAt: Date | null;
  completedAt: Date | null;
  pendingDecision?: 'approve' | 'reject' | null;
  requisicao?: IReclamacaoWorkflowRequisicao;
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
  workflow?: IReclamacaoWorkflow;
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

const ReclamacaoWorkflowComunicacaoSchema = new Schema(
  {
    mensagem: { type: String, default: '' },
    data: { type: Date, default: Date.now },
    autor: { type: String, default: '' },
  },
  { _id: false },
);

const ReclamacaoWorkflowRequisicaoSchema = new Schema<IReclamacaoWorkflowRequisicao>(
  {
    preenchidaEm: { type: Date, default: null },
    preenchidaPor: { type: String, default: '' },
    valores: { type: Schema.Types.Mixed, default: {} },
    comunicacaoWorkflow: { type: [ReclamacaoWorkflowComunicacaoSchema], default: [] },
  },
  { _id: false },
);

const ReclamacaoWorkflowSchema = new Schema<IReclamacaoWorkflow>(
  {
    active: { type: Boolean, default: false },
    workflowStatus: { type: String, enum: ['active', 'finished'], default: null },
    workflowId: { type: Schema.Types.ObjectId, default: null },
    step: { type: Number, default: 0 },
    passoId: { type: Schema.Types.ObjectId, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pendingDecision: { type: String, enum: ['approve', 'reject', null], default: null },
    requisicao: { type: ReclamacaoWorkflowRequisicaoSchema, default: undefined },
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
    idDemandaExterna: { type: String, default: undefined },
    atendente: { type: String, default: '' },
    responsavel: { type: String, default: '' },
    workflowId: { type: Schema.Types.ObjectId, default: undefined },
    workflowSlug: { type: String, default: '' },
    workflowAtivo: { type: Boolean, default: false },
    workflow: { type: ReclamacaoWorkflowSchema, default: undefined },
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
ReclamacaoBaseSchema.index(
  { idDemandaExterna: 1 },
  {
    unique: true,
    name: 'idDemandaExterna_unique',
    partialFilterExpression: { idDemandaExterna: { $exists: true, $type: 'string', $gt: '' } },
  },
);
