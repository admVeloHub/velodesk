/** GrupoResponsabilidade v1.0.0 — desk_config.grupos_responsabilidade */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IGrupoMembro {
  tipo: 'colaborador' | 'email' | 'perfil_desk';
  valor: string;
}

export interface IGrupoResponsabilidade extends Document {
  _id: Types.ObjectId;
  slug: string;
  nome: string;
  descricao: string;
  ordem: number;
  ativo: boolean;
  membros: IGrupoMembro[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const MembroSchema = new Schema<IGrupoMembro>(
  {
    tipo: { type: String, required: true, enum: ['colaborador', 'email', 'perfil_desk'] },
    valor: { type: String, required: true },
  },
  { _id: false },
);

const GrupoResponsabilidadeSchema = new Schema<IGrupoResponsabilidade>(
  {
    slug: { type: String, required: true },
    nome: { type: String, required: true },
    descricao: { type: String, default: '' },
    ordem: { type: Number, default: 0 },
    ativo: { type: Boolean, default: true },
    membros: { type: [MembroSchema], default: [] },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'grupos_responsabilidade',
  },
);

GrupoResponsabilidadeSchema.index({ slug: 1 }, { unique: true });
GrupoResponsabilidadeSchema.index({ ativo: 1, ordem: 1 });

export function getGrupoResponsabilidadeModel(): Model<IGrupoResponsabilidade> {
  const conn = getDeskConfigConnection();
  if (conn.models.GrupoResponsabilidade) {
    return conn.models.GrupoResponsabilidade as Model<IGrupoResponsabilidade>;
  }
  return conn.model<IGrupoResponsabilidade>('GrupoResponsabilidade', GrupoResponsabilidadeSchema);
}
