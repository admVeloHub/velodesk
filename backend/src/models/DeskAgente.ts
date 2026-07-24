/** DeskAgente v1.0.0 — desk_config.desk_agentes */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IDeskAgente extends Document {
  _id: Types.ObjectId;
  email: string;
  velohubId: string;
  colaboradorNome: string;
  empresa: string;
  departamento: string;
  atuacao: Array<{ funcao?: string } | string>;
  funcaoSlug: string | null;
  afastado: boolean;
  updatedBy: string;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeskAgenteSchema = new Schema<IDeskAgente>(
  {
    email: { type: String, required: true },
    velohubId: { type: String, default: '' },
    colaboradorNome: { type: String, default: '' },
    empresa: { type: String, default: '' },
    departamento: { type: String, default: '' },
    atuacao: { type: Schema.Types.Mixed, default: [] },
    funcaoSlug: { type: String, default: null },
    afastado: { type: Boolean, default: false },
    updatedBy: { type: String, default: '' },
    syncedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'desk_agentes',
  },
);

DeskAgenteSchema.index({ email: 1 }, { unique: true });
DeskAgenteSchema.index({ funcaoSlug: 1 });

export function getDeskAgenteModel(): Model<IDeskAgente> {
  const conn = getDeskConfigConnection();
  if (conn.models.DeskAgente) {
    return conn.models.DeskAgente as Model<IDeskAgente>;
  }
  return conn.model<IDeskAgente>('DeskAgente', DeskAgenteSchema);
}
