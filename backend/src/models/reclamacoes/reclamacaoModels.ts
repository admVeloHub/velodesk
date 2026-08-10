/** reclamacaoModels v1.0.0 — models por collection em chamados_reclamacoes */
import type { Model } from 'mongoose';
import { getReclamacoesConnection } from '../../config/database';
import {
  ReclamacaoBaseSchema,
  type IReclamacao,
} from './ReclamacaoBase.schema';

const MODEL_CONFIG = {
  ReclamacaoReclameAqui: 'reclamacoes_reclameAqui',
  ReclamacaoProcon: 'reclamacoes_procon',
  ReclamacaoBacen: 'reclamacoes_bacen',
  ReclamacaoConsumidorGov: 'reclamacoes_consumidorGov',
} as const;

type ReclamacaoModelName = keyof typeof MODEL_CONFIG;

function getReclamacaoModel(modelName: ReclamacaoModelName): Model<IReclamacao> {
  const conn = getReclamacoesConnection();
  const collection = MODEL_CONFIG[modelName];
  if (conn.models[modelName]) {
    return conn.models[modelName] as Model<IReclamacao>;
  }
  return conn.model<IReclamacao>(modelName, ReclamacaoBaseSchema, collection);
}

export function getReclamacaoReclameAquiModel(): Model<IReclamacao> {
  return getReclamacaoModel('ReclamacaoReclameAqui');
}

export function getReclamacaoProconModel(): Model<IReclamacao> {
  return getReclamacaoModel('ReclamacaoProcon');
}

export function getReclamacaoBacenModel(): Model<IReclamacao> {
  return getReclamacaoModel('ReclamacaoBacen');
}

export function getReclamacaoConsumidorGovModel(): Model<IReclamacao> {
  return getReclamacaoModel('ReclamacaoConsumidorGov');
}

export type { IReclamacao };
