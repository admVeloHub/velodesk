/** TicketIaSettings v1.0.0 — configuração versionada da análise de tickets */
import mongoose, { Document, Schema } from 'mongoose';

export interface ITicketIaAlias {
  de: string;
  para: string;
}

export interface ITicketIaSettings extends Document {
  key: 'default';
  contextoEmpresa: string;
  instrucoesOutros: string;
  taxonomiaMotivos: string[];
  motivoAliases: ITicketIaAlias[];
  contextoVersao: number;
  maxTicketsPorCiclo: number;
  maxExemplosPorMotivo: number;
  maxExemplosTotal: number;
  sourceProject: string;
  sourceExportedAt?: Date;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TicketIaAliasSchema = new Schema<ITicketIaAlias>(
  {
    de: { type: String, required: true },
    para: { type: String, required: true },
  },
  { _id: false },
);

const TicketIaSettingsSchema = new Schema<ITicketIaSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    contextoEmpresa: { type: String, default: '' },
    instrucoesOutros: { type: String, default: '' },
    taxonomiaMotivos: { type: [String], default: [] },
    motivoAliases: { type: [TicketIaAliasSchema], default: [] },
    contextoVersao: { type: Number, required: true, default: 1 },
    maxTicketsPorCiclo: { type: Number, default: 60 },
    maxExemplosPorMotivo: { type: Number, default: 3 },
    maxExemplosTotal: { type: Number, default: 60 },
    sourceProject: { type: String, default: 'velodesk' },
    sourceExportedAt: { type: Date },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'ticket_ia_settings' },
);

export const TicketIaSettings = mongoose.model<ITicketIaSettings>(
  'TicketIaSettings',
  TicketIaSettingsSchema,
);
