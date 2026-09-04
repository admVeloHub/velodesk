/** Macro v1.0.0 — desk_config.macros (respostas rápidas do compose) */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export interface IMacro extends Document {
  nome: string;
  /** HTML rico (mesmo formato do compose) — pode conter <a href> com links reais. */
  texto: string;
  ordem: number;
  ativo: boolean;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const MacroSchema = new Schema<IMacro>(
  {
    nome: { type: String, required: true, trim: true },
    texto: { type: String, default: '' },
    ordem: { type: Number, default: 0 },
    ativo: { type: Boolean, default: true },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'macros',
  },
);

MacroSchema.index({ ativo: 1, ordem: 1 });

export function getMacroModel(): Model<IMacro> {
  const conn = getDeskConfigConnection();
  if (conn.models.Macro) {
    return conn.models.Macro as Model<IMacro>;
  }
  return conn.model<IMacro>('Macro', MacroSchema);
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
