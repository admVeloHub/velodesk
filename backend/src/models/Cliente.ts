/** Cliente v1.1.0 — b2c_cadastros.clientes; telefone WhatsApp em clienteTelefone.whatsapp */
import { Schema, Document, Model } from 'mongoose';
import { getCadastrosConnection } from '../config/database';

export interface IClienteTelefone {
  lista: string[];
  whatsapp?: string;
}

export interface IClienteDados {
  clienteCpf: string;
  clienteNome: string;
  clienteEmail: { lista: string[] };
  clienteTelefone: IClienteTelefone;
}

export interface IAtendimentoHistorico {
  chamadoProtocolo: string;
  resumo: string;
  avaliacao: string;
}

export interface ICliente extends Document {
  clienteDados: IClienteDados[];
  atendimentoHistorico: IAtendimentoHistorico[];
  createdAt: Date;
  updatedAt: Date;
}

const ClienteDadosSchema = new Schema<IClienteDados>(
  {
    clienteCpf: { type: String, default: '' },
    clienteNome: { type: String, default: '' },
    clienteEmail: { lista: { type: [String], default: [] } },
    clienteTelefone: {
      lista: { type: [String], default: [] },
      whatsapp: { type: String, default: '' },
    },
  },
  { _id: false }
);

const AtendimentoHistoricoSchema = new Schema<IAtendimentoHistorico>(
  {
    chamadoProtocolo: { type: String, default: '' },
    resumo: { type: String, default: '' },
    avaliacao: { type: String, default: '' },
  },
  { _id: false }
);

const ClienteSchema = new Schema<ICliente>(
  {
    clienteDados: { type: [ClienteDadosSchema], default: [] },
    atendimentoHistorico: { type: [AtendimentoHistoricoSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'clientes',
  }
);

ClienteSchema.index({ 'clienteDados.clienteCpf': 1 }, { unique: true, sparse: true });

export function getClienteModel(): Model<ICliente> {
  const conn = getCadastrosConnection();
  if (conn.models.Cliente) {
    return conn.models.Cliente as Model<ICliente>;
  }
  return conn.model<ICliente>('Cliente', ClienteSchema);
}
