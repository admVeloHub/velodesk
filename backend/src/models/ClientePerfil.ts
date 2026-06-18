/** ClientePerfil v1.0.0 — b2c_chamados.cliente_perfil (LISTA_SCHEMA_DESK.rb) */
import mongoose, { Schema, Document } from 'mongoose';
import type { IClienteContato } from './ChamadoN1';

export interface IAtendimentoHistorico {
  chamadoProtocolo: string;
  resumo: string;
  avaliacao: string;
}

export interface IClientePerfil extends Document {
  cliente: IClienteContato[];
  atendimentoHistorico: IAtendimentoHistorico[];
  createdAt: Date;
  updatedAt: Date;
}

const ClienteContatoSchema = new Schema(
  {
    clienteCpf: { type: String, default: '' },
    clienteNome: { type: String, default: '' },
    clienteEmail: { lista: { type: [String], default: [] } },
    clienteTelefone: { lista: { type: [String], default: [] } },
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

const ClientePerfilSchema = new Schema<IClientePerfil>(
  {
    cliente: { type: [ClienteContatoSchema], default: [] },
    atendimentoHistorico: { type: [AtendimentoHistoricoSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'cliente_perfil',
  }
);

export const ClientePerfil = mongoose.model<IClientePerfil>('ClientePerfil', ClientePerfilSchema);
