/** TabulacaoOpcoes v1.0.0 — desk_config.tabulacao_opcoes (doc por categoria) */
import { Schema, Document, Model, Types } from 'mongoose';
import { getDeskConfigConnection } from '../config/database';

export const TABULACAO_OPCOES_CATEGORIAS = {
  TIPO_CHAMADO: 'tipo_chamado',
  CANAL_CONTATO: 'canal_contato',
} as const;

export type TabulacaoOpcoesCategoria =
  (typeof TABULACAO_OPCOES_CATEGORIAS)[keyof typeof TABULACAO_OPCOES_CATEGORIAS];

export interface ITabulacaoOpcaoItem {
  _id: Types.ObjectId;
  valor: string;
  ordem: number;
  ativo: boolean;
}

export interface ITabulacaoOpcoes extends Document {
  categoria: TabulacaoOpcoesCategoria;
  opcoes: ITabulacaoOpcaoItem[];
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const OpcaoItemSchema = new Schema<ITabulacaoOpcaoItem>(
  {
    valor: { type: String, required: true },
    ordem: { type: Number, default: 0 },
    ativo: { type: Boolean, default: true },
  },
  { _id: true }
);

const TabulacaoOpcoesSchema = new Schema<ITabulacaoOpcoes>(
  {
    categoria: { type: String, required: true },
    opcoes: { type: [OpcaoItemSchema], default: [] },
    updatedBy: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'tabulacao_opcoes',
  }
);

TabulacaoOpcoesSchema.index({ categoria: 1 }, { unique: true });

export function getTabulacaoOpcoesModel(): Model<ITabulacaoOpcoes> {
  const conn = getDeskConfigConnection();
  if (conn.models.TabulacaoOpcoes) {
    return conn.models.TabulacaoOpcoes as Model<ITabulacaoOpcoes>;
  }
  return conn.model<ITabulacaoOpcoes>('TabulacaoOpcoes', TabulacaoOpcoesSchema);
}
