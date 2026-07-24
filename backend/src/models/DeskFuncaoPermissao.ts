/** DeskFuncaoPermissao v1.0.0 — desk_config.desk_funcoes_permissoes */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';
import type { PermissoesMap } from '../config/funcaoPermissaoDefaults';

export interface IDeskFuncaoPermissao extends Document {
  _id: Types.ObjectId;
  slug: string;
  nome: string;
  nivel: number;
  herdaDe: string[];
  portalVisivel: string[];
  canalOrigem?: string;
  permissoes: PermissoesMap;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PermissoesSchema = new Schema(
  {},
  { strict: false, _id: false },
);

const DeskFuncaoPermissaoSchema = new Schema<IDeskFuncaoPermissao>(
  {
    slug: { type: String, required: true },
    nome: { type: String, required: true },
    nivel: { type: Number, default: 1 },
    herdaDe: { type: [String], default: [] },
    portalVisivel: { type: [String], default: ['agent'] },
    canalOrigem: { type: String, default: '' },
    permissoes: { type: PermissoesSchema, default: {} },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'desk_funcoes_permissoes',
  },
);

DeskFuncaoPermissaoSchema.index({ slug: 1 }, { unique: true });
DeskFuncaoPermissaoSchema.index({ nivel: 1 });

export function getDeskFuncaoPermissaoModel(): Model<IDeskFuncaoPermissao> {
  const conn = getDeskConfigConnection();
  if (conn.models.DeskFuncaoPermissao) {
    return conn.models.DeskFuncaoPermissao as Model<IDeskFuncaoPermissao>;
  }
  return conn.model<IDeskFuncaoPermissao>('DeskFuncaoPermissao', DeskFuncaoPermissaoSchema);
}
