/** ChamadoN1 v1.5.1 — chamadoProtocolo opcional até atribuição pelo Desk */
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChamadoWorkflow {
  active: boolean;
  workflowId: Types.ObjectId | null;
  step: number;
  passoId: Types.ObjectId | null;
  startedAt: Date | null;
  completedAt: Date | null;
  pendingDecision?: 'approve' | 'reject' | null;
}

export interface IClienteRef {
  clienteCpf: string;
  clienteId: Types.ObjectId | null;
}

export interface ITabulacao {
  tipoChamado: string;
  produto: string;
  motivo: string;
  detalhe: string;
  responsavel: string;
  atribuido: string;
}

export interface IRegistro {
  data: Date;
  origin: string;
  autor: string;
  mensagemPublica: string;
  anexosMensagemPublica: string[];
  anotacaoInterna: string;
  anexosAnotacaoInterna: string[];
  /** Histórico de campos alterados neste evento (valores novos). */
  alteracoes: unknown[];
  /** Metadados técnicos do evento (ex.: e-mail inbound), fora do histórico de negócio. */
  metadados: Record<string, unknown>;
  status: string;
}

export interface IChamadoN1 extends Document {
  chamadoProtocolo: string;
  chamadoTitulo: string;
  cliente: IClienteRef[];
  tabulacao: ITabulacao[];
  registro: IRegistro[];
  workflow?: IChamadoWorkflow;
  createdAt: Date;
  updatedAt: Date;
}

const ClienteRefSchema = new Schema<IClienteRef>(
  {
    clienteCpf: { type: String, default: '' },
    clienteId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false }
);

const TabulacaoSchema = new Schema<ITabulacao>(
  {
    tipoChamado: { type: String, default: '' },
    produto: { type: String, default: '' },
    motivo: { type: String, default: '' },
    detalhe: { type: String, default: '' },
    responsavel: { type: String, default: '' },
    atribuido: { type: String, default: '' },
  },
  { _id: false }
);

const RegistroSchema = new Schema<IRegistro>(
  {
    data: { type: Date, default: Date.now },
    origin: { type: String, default: '' },
    autor: { type: String, default: '' },
    mensagemPublica: { type: String, default: '' },
    anexosMensagemPublica: { type: [String], default: [] },
    anotacaoInterna: { type: String, default: '' },
    anexosAnotacaoInterna: { type: [String], default: [] },
    alteracoes: { type: [Schema.Types.Mixed], default: [] },
    metadados: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'novo' },
  },
  { _id: false }
);

const ChamadoWorkflowSchema = new Schema<IChamadoWorkflow>(
  {
    active: { type: Boolean, default: false },
    workflowId: { type: Schema.Types.ObjectId, default: null },
    step: { type: Number, default: 0 },
    passoId: { type: Schema.Types.ObjectId, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pendingDecision: { type: String, enum: ['approve', 'reject'], default: null },
  },
  { _id: false },
);

const ChamadoN1Schema = new Schema<IChamadoN1>(
  {
    chamadoProtocolo: { type: String },
    chamadoTitulo: { type: String, default: '' },
    cliente: { type: [ClienteRefSchema], default: [] },
    tabulacao: { type: [TabulacaoSchema], default: [] },
    registro: { type: [RegistroSchema], default: [] },
    workflow: { type: ChamadoWorkflowSchema, default: undefined },
  },
  {
    timestamps: true,
    collection: 'chamados_n1',
  }
);

ChamadoN1Schema.index({ chamadoProtocolo: 1 }, { unique: true, sparse: true, name: 'chamadoProtocolo_1' });

export const ChamadoN1 = mongoose.model<IChamadoN1>('ChamadoN1', ChamadoN1Schema);
