/** EmailConteudo v1.0.0 — desk_config.email_conteudos */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export const EMAIL_CRITERIO_TIPOS = ['canal', 'status', 'sla', 'gatilho_interno'] as const;
export type EmailCriterioTipo = (typeof EMAIL_CRITERIO_TIPOS)[number];

export interface IEmailCriterio {
  tipo: EmailCriterioTipo;
  valores: string[];
}

export interface IEmailConteudo extends Document {
  nome: string;
  ativo: boolean;
  saudacao: string;
  corpo: string;
  gatilho: { criterios: IEmailCriterio[] };
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CriterioSchema = new Schema<IEmailCriterio>(
  {
    tipo: { type: String, required: true, enum: EMAIL_CRITERIO_TIPOS },
    valores: { type: [String], default: [] },
  },
  { _id: false },
);

const EmailConteudoSchema = new Schema<IEmailConteudo>(
  {
    nome: { type: String, required: true, trim: true },
    ativo: { type: Boolean, default: true },
    saudacao: { type: String, default: '' },
    corpo: { type: String, default: '' },
    gatilho: {
      criterios: { type: [CriterioSchema], default: [] },
    },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'email_conteudos',
  },
);

export function getEmailConteudoModel(): Model<IEmailConteudo> {
  const conn = getDeskConfigConnection();
  if (conn.models.EmailConteudo) {
    return conn.models.EmailConteudo as Model<IEmailConteudo>;
  }
  return conn.model<IEmailConteudo>('EmailConteudo', EmailConteudoSchema);
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
