/** ReclameAquiHugmeRegistro.schema v1.0.0 — base Hugme por Id Origem */
import { Schema, Document, Types } from 'mongoose';

export type HugmeOrigemImportacao = 'base_inicial' | 'incremental';

export interface IReclameAquiHugmeRegistro extends Document {
  idOrigem: string;
  idHugme?: string;
  colunasOriginais: Record<string, string>;
  cabecalhos: string[];
  consumidor: string;
  cpf?: string;
  email?: string;
  telefoneWhatsapp?: string;
  assunto: string;
  descricao: string;
  produto?: string;
  tipo?: string;
  motivo?: string;
  nota?: string;
  statusRa?: string;
  statusHugme?: string;
  statusRaLabel?: string;
  dataReclamacao?: Date;
  dataResposta?: Date;
  respostaPublica?: string;
  cidade?: string;
  uf?: string;
  chamadoId?: Types.ObjectId | null;
  chamadoProtocolo?: string;
  reclamacaoId?: Types.ObjectId | null;
  ticketCriadoEm?: Date;
  ultimoImportBatchId?: string;
  primeiroImportEm: Date;
  ultimoImportEm: Date;
  origemImportacao: HugmeOrigemImportacao;
  createdAt: Date;
  updatedAt: Date;
}

export const ReclameAquiHugmeRegistroSchema = new Schema<IReclameAquiHugmeRegistro>(
  {
    idOrigem: { type: String, required: true, trim: true },
    idHugme: { type: String, default: '', trim: true },
    colunasOriginais: { type: Schema.Types.Mixed, default: {} },
    cabecalhos: { type: [String], default: [] },
    consumidor: { type: String, default: '' },
    cpf: { type: String, default: '' },
    email: { type: String, default: '' },
    telefoneWhatsapp: { type: String, default: '' },
    assunto: { type: String, default: '' },
    descricao: { type: String, default: '' },
    produto: { type: String, default: '' },
    tipo: { type: String, default: '' },
    motivo: { type: String, default: '' },
    nota: { type: String, default: '' },
    statusRa: { type: String, default: '' },
    statusHugme: { type: String, default: '' },
    statusRaLabel: { type: String, default: '' },
    dataReclamacao: { type: Date, default: undefined },
    dataResposta: { type: Date, default: undefined },
    respostaPublica: { type: String, default: '' },
    cidade: { type: String, default: '' },
    uf: { type: String, default: '' },
    chamadoId: { type: Schema.Types.ObjectId, default: null, ref: 'ChamadoN1' },
    chamadoProtocolo: { type: String, default: '' },
    reclamacaoId: { type: Schema.Types.ObjectId, default: null },
    ticketCriadoEm: { type: Date, default: undefined },
    ultimoImportBatchId: { type: String, default: '' },
    primeiroImportEm: { type: Date, required: true },
    ultimoImportEm: { type: Date, required: true },
    origemImportacao: {
      type: String,
      enum: ['base_inicial', 'incremental'],
      required: true,
    },
  },
  { timestamps: true },
);

ReclameAquiHugmeRegistroSchema.index({ idOrigem: 1 }, { unique: true, name: 'idOrigem_unique' });
ReclameAquiHugmeRegistroSchema.index({ idHugme: 1 }, { sparse: true, name: 'idHugme_sparse' });
ReclameAquiHugmeRegistroSchema.index({ chamadoId: 1 }, { sparse: true, name: 'chamadoId_sparse' });
ReclameAquiHugmeRegistroSchema.index({ ultimoImportEm: -1 }, { name: 'ultimoImportEm_desc' });
