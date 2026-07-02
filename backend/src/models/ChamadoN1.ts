/** ChamadoN1 v1.3.0 — alteracoes[] histórico + metadados técnicos no registro */
import mongoose, { Schema, Document, Types } from 'mongoose';

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

const ChamadoN1Schema = new Schema<IChamadoN1>(
  {
    chamadoProtocolo: { type: String, required: true, unique: true },
    chamadoTitulo: { type: String, default: '' },
    cliente: { type: [ClienteRefSchema], default: [] },
    tabulacao: { type: [TabulacaoSchema], default: [] },
    registro: { type: [RegistroSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'chamados_n1',
  }
);

export const ChamadoN1 = mongoose.model<IChamadoN1>('ChamadoN1', ChamadoN1Schema);
