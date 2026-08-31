/** ChamadoN1 v1.13.0 — workflowStatus active/finished/cancel persistente */
import mongoose, { Schema, Document, Types } from 'mongoose';
import type { IChamadoWorkflowRequisicao } from '../config/workflowRequisicaoDefaults';

/** Valores canônicos de registro.status */
export const CHAMADO_STATUS_VALUES = [
  'novo',
  'em-aberto',
  'em-andamento',
  'em-espera',
  'pendente',
  'resolvido',
  'cancelado',
  'fechado',
] as const;

export type ChamadoStatus = (typeof CHAMADO_STATUS_VALUES)[number];

export type FusaoHierarquia = 'superior' | 'inferior' | 'redundante';

/** Vínculo de fusão (espelha Fusao do VeloHub Ouvidoria). */
export interface IChamadoFusao {
  fundido: boolean;
  dataFundido: Date | null;
  hierarquia: FusaoHierarquia | '';
  parentId: Types.ObjectId | null;
  childId: Types.ObjectId | null;
  parentProtocolo?: string;
  childProtocolo?: string;
  childProtocolos?: string[];
  childIds?: Types.ObjectId[];
}

export const WORKFLOW_STATUS_VALUES = ['active', 'finished', 'cancel'] as const;
export type WorkflowRuntimeStatus = (typeof WORKFLOW_STATUS_VALUES)[number];

export interface IChamadoWorkflow {
  active: boolean;
  workflowStatus?: WorkflowRuntimeStatus | null;
  workflowId: Types.ObjectId | null;
  step: number;
  passoId: Types.ObjectId | null;
  startedAt: Date | null;
  completedAt: Date | null;
  pendingDecision?: 'approve' | 'reject' | null;
  requisicao?: IChamadoWorkflowRequisicao;
}

export interface IChamadoCsat {
  enviado: boolean;
  enviadoEm: Date | null;
  nota: number | null;
  comentario: string;
  respondido: boolean;
  respondidoEm: Date | null;
  repescagemEnviada: boolean;
  repescagemEnviadaEm: Date | null;
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
  canal: string;
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
  fusao?: IChamadoFusao;
  csat?: IChamadoCsat;
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
    canal: { type: String, default: '' },
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
    status: {
      type: String,
      enum: CHAMADO_STATUS_VALUES,
      default: 'novo',
    },
  },
  { _id: false }
);

const ComunicacaoWorkflowSchema = new Schema(
  {
    mensagem: { type: String, default: '' },
    data: { type: Date, default: Date.now },
    autor: { type: String, default: '' },
    autorEmail: { type: String, default: '' },
  },
  { _id: false },
);

const ComunicacaoResumoSchema = new Schema(
  {
    ultimaOrigem: { type: String, default: null },
    ultimaData: { type: Date, default: null },
    temRespostaAgente: { type: Boolean, default: false },
    // E-mail de quem mandou a última mensagem do lado "workflow" — usado pra notificar de
    // volta essa mesma pessoa quando o agente responde (não sobrescrito por respostas do agente).
    ultimoWorkflowAutorEmail: { type: String, default: '' },
    // Última vez que o lado workflow abriu o ticket depois da resposta do agente — esconde o
    // badge "Aguardando resposta" na fila de aprovação sem exigir uma nova mensagem enviada.
    vistoResponsavelEm: { type: Date, default: null },
  },
  { _id: false },
);

const ChamadoWorkflowRequisicaoSchema = new Schema(
  {
    preenchidaEm: { type: Date, default: null },
    preenchidaPor: { type: String, default: '' },
    valores: { type: Schema.Types.Mixed, default: {} },
    comunicacaoWorkflow: { type: [ComunicacaoWorkflowSchema], default: [] },
    comunicacaoResumo: { type: ComunicacaoResumoSchema, default: undefined },
    solicitacaoProdutos: { type: Schema.Types.Mixed, default: undefined },
    solicitacaoFinanceiro: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false },
);

const ChamadoWorkflowSchema = new Schema<IChamadoWorkflow>(
  {
    active: { type: Boolean, default: false },
    workflowStatus: { type: String, enum: WORKFLOW_STATUS_VALUES, default: null },
    workflowId: { type: Schema.Types.ObjectId, default: null },
    step: { type: Number, default: 0 },
    passoId: { type: Schema.Types.ObjectId, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    pendingDecision: { type: String, enum: ['approve', 'reject'], default: null },
    requisicao: { type: ChamadoWorkflowRequisicaoSchema, default: undefined },
  },
  { _id: false },
);

const ChamadoFusaoSchema = new Schema<IChamadoFusao>(
  {
    fundido: { type: Boolean, default: false },
    dataFundido: { type: Date, default: null },
    hierarquia: {
      type: String,
      enum: ['superior', 'inferior', 'redundante', ''],
      default: '',
    },
    parentId: { type: Schema.Types.ObjectId, default: null },
    childId: { type: Schema.Types.ObjectId, default: null },
    parentProtocolo: { type: String, default: '' },
    childProtocolo: { type: String, default: '' },
    childProtocolos: { type: [String], default: [] },
    childIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { _id: false },
);

const ChamadoCsatSchema = new Schema<IChamadoCsat>(
  {
    enviado: { type: Boolean, default: false },
    enviadoEm: { type: Date, default: null },
    nota: { type: Number, min: 1, max: 5, default: null },
    comentario: { type: String, default: '' },
    respondido: { type: Boolean, default: false },
    respondidoEm: { type: Date, default: null },
    repescagemEnviada: { type: Boolean, default: false },
    repescagemEnviadaEm: { type: Date, default: null },
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
    fusao: { type: ChamadoFusaoSchema, default: undefined },
    csat: { type: ChamadoCsatSchema, default: undefined },
  },
  {
    timestamps: true,
    collection: 'chamados_n1',
  }
);

ChamadoN1Schema.index({ chamadoProtocolo: 1 }, { unique: true, sparse: true, name: 'chamadoProtocolo_1' });
ChamadoN1Schema.index({ 'cliente.clienteCpf': 1 }, { name: 'cliente_clienteCpf_1' });
// Aceleram os cards de Gestão (volume/resumo/voz-cliente/casos-especiais), que filtram por
// data de criação e por datas de eventos do histórico. Sem estes índices, cada card fazia
// varredura completa de coleção (15-19s em produção).
ChamadoN1Schema.index({ createdAt: 1 }, { name: 'createdAt_1' });
ChamadoN1Schema.index({ 'registro.data': 1 }, { name: 'registro_data_1' });
// Acelera as agregações de CSAT (gestaoInsights/workspace360) que filtram por respostas
// dentro de um período.
ChamadoN1Schema.index({ 'csat.respondido': 1, 'csat.respondidoEm': 1 }, { name: 'csat_respondido_1' });

export const ChamadoN1 = mongoose.model<IChamadoN1>('ChamadoN1', ChamadoN1Schema);
