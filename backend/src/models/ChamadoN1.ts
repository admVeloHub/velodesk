/** ChamadoN1 v1.0.1 — b2c_chamados.chamados_n1 (LISTA_SCHEMA_DESK.rb; processo[] adiado) */
import mongoose, { Schema, Document } from 'mongoose';

export interface IClienteContato {
  clienteCpf: string;
  clienteNome: string;
  clienteEmail: { lista: string[] };
  clienteTelefone: { lista: string[] };
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
  mensagemPublica: string;
  anexosMensagemPublica: string[];
  anotacaoInterna: string;
  anexosAnotacaoInterna: string[];
  alteracoes: Record<string, unknown>;
  status: string;
}

export interface IChamadoN1 extends Document {
  chamadoProtocolo: string;
  chamadoTitulo: string;
  cliente: IClienteContato[];
  tabulacao: ITabulacao[];
  registro: IRegistro[];
  createdAt: Date;
  updatedAt: Date;
}

const ClienteContatoSchema = new Schema<IClienteContato>(
  {
    clienteCpf: { type: String, default: '' },
    clienteNome: { type: String, default: '' },
    clienteEmail: { lista: { type: [String], default: [] } },
    clienteTelefone: { lista: { type: [String], default: [] } },
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
    mensagemPublica: { type: String, default: '' },
    anexosMensagemPublica: { type: [String], default: [] },
    anotacaoInterna: { type: String, default: '' },
    anexosAnotacaoInterna: { type: [String], default: [] },
    alteracoes: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'novo' },
  },
  { _id: false }
);

const ChamadoN1Schema = new Schema<IChamadoN1>(
  {
    chamadoProtocolo: { type: String, required: true, unique: true },
    chamadoTitulo: { type: String, default: '' },
    cliente: { type: [ClienteContatoSchema], default: [] },
    tabulacao: { type: [TabulacaoSchema], default: [] },
    registro: { type: [RegistroSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'chamados_n1',
  }
);

export const ChamadoN1 = mongoose.model<IChamadoN1>('ChamadoN1', ChamadoN1Schema);
