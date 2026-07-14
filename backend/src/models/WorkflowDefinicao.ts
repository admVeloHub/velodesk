/** WorkflowDefinicao v1.1.0 — desk_config.workflow_definicoes */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IWorkflowCriterio {
  _id?: Types.ObjectId;
  fonte: 'tabulacao' | 'grupo_responsabilidade' | 'integracao';
  campo: string;
  operador: 'equals' | 'contains' | 'not_empty' | 'in';
  valor: string;
}

export interface IWorkflowAtribuicao {
  tipo: 'grupo' | 'colaborador' | 'responsavel_ticket' | 'sistema';
  grupoSlug: string;
  colaborador: string;
}

export interface IWorkflowRota {
  _id?: Types.ObjectId;
  variavel: string;
  rotulo: string;
  proximoPassoId: Types.ObjectId | null;
  statusTicket: string | null;
}

export interface IWorkflowPassoConfig {
  nome: string;
  descricao: string;
  icone: string;
  slaHoras: number | null;
  criterios: IWorkflowCriterio[];
  atribuicao: IWorkflowAtribuicao;
  acao: {
    tipo: 'manual' | 'aprovacao' | 'automatica';
    rotas: IWorkflowRota[];
  };
}

export interface IWorkflowPassoEnvelope {
  _id?: Types.ObjectId;
  ordem: number;
  passo: IWorkflowPassoConfig;
}

export interface IWorkflowGatilho {
  tipo: string;
  descricao: string;
  criterios: IWorkflowCriterio[];
}

export interface IWorkflowDefinicao extends Document {
  _id: Types.ObjectId;
  slug: string;
  titulo: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  gatilho: IWorkflowGatilho;
  passos: IWorkflowPassoEnvelope[];
  passoInicialId: Types.ObjectId | null;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CriterioSchema = new Schema<IWorkflowCriterio>(
  {
    fonte: { type: String, required: true, enum: ['tabulacao', 'grupo_responsabilidade', 'integracao'] },
    campo: { type: String, required: true },
    operador: { type: String, required: true, enum: ['equals', 'contains', 'not_empty', 'in'] },
    valor: { type: String, default: '' },
  },
  { _id: true },
);

const AtribuicaoSchema = new Schema<IWorkflowAtribuicao>(
  {
    tipo: { type: String, required: true, enum: ['grupo', 'colaborador', 'responsavel_ticket', 'sistema'] },
    grupoSlug: { type: String, default: '' },
    colaborador: { type: String, default: '' },
  },
  { _id: false },
);

const RotaSchema = new Schema<IWorkflowRota>(
  {
    variavel: { type: String, required: true },
    rotulo: { type: String, required: true },
    proximoPassoId: { type: Schema.Types.ObjectId, default: null },
    statusTicket: { type: String, default: null },
  },
  { _id: true },
);

const PassoConfigSchema = new Schema<IWorkflowPassoConfig>(
  {
    nome: { type: String, required: true },
    descricao: { type: String, default: '' },
    icone: { type: String, default: 'ti-circle' },
    slaHoras: { type: Number, default: null },
    criterios: { type: [CriterioSchema], default: [] },
    atribuicao: { type: AtribuicaoSchema, default: () => ({ tipo: 'sistema', grupoSlug: '', colaborador: '' }) },
    acao: {
      tipo: { type: String, enum: ['manual', 'aprovacao', 'automatica'], default: 'manual' },
      rotas: { type: [RotaSchema], default: [] },
    },
  },
  { _id: false },
);

const PassoEnvelopeSchema = new Schema<IWorkflowPassoEnvelope>(
  {
    ordem: { type: Number, default: 0 },
    passo: { type: PassoConfigSchema, required: true },
  },
  { _id: true },
);

const WorkflowDefinicaoSchema = new Schema<IWorkflowDefinicao>(
  {
    slug: { type: String, required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, default: '' },
    ordem: { type: Number, default: 0 },
    ativo: { type: Boolean, default: true },
    gatilho: {
      tipo: { type: String, default: 'tabulacao' },
      descricao: { type: String, default: '' },
      criterios: { type: [CriterioSchema], default: [] },
    },
    passos: { type: [PassoEnvelopeSchema], default: [] },
    passoInicialId: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'workflow_definicoes',
  },
);

WorkflowDefinicaoSchema.index({ slug: 1 }, { unique: true });
WorkflowDefinicaoSchema.index({ ativo: 1, ordem: 1 });

export function getWorkflowDefinicaoModel(): Model<IWorkflowDefinicao> {
  const conn = getDeskConfigConnection();
  if (conn.models.WorkflowDefinicao) {
    return conn.models.WorkflowDefinicao as Model<IWorkflowDefinicao>;
  }
  return conn.model<IWorkflowDefinicao>('WorkflowDefinicao', WorkflowDefinicaoSchema);
}
