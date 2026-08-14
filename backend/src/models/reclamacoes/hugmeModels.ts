/** hugmeModels v1.0.0 — models Hugme em chamados_reclamacoes */
import type { Model } from 'mongoose';
import { getReclamacoesConnection } from '../../config/database';
import {
  ReclameAquiHugmeRegistroSchema,
  type IReclameAquiHugmeRegistro,
} from './ReclameAquiHugmeRegistro.schema';
import {
  ReclameAquiHugmeImportBatchSchema,
  type IReclameAquiHugmeImportBatch,
} from './ReclameAquiHugmeImportBatch.schema';

export function getReclameAquiHugmeRegistroModel(): Model<IReclameAquiHugmeRegistro> {
  const conn = getReclamacoesConnection();
  if (conn.models.ReclameAquiHugmeRegistro) {
    return conn.models.ReclameAquiHugmeRegistro as Model<IReclameAquiHugmeRegistro>;
  }
  return conn.model<IReclameAquiHugmeRegistro>(
    'ReclameAquiHugmeRegistro',
    ReclameAquiHugmeRegistroSchema,
    'reclame_aqui_hugme_registros',
  );
}

export function getReclameAquiHugmeImportBatchModel(): Model<IReclameAquiHugmeImportBatch> {
  const conn = getReclamacoesConnection();
  if (conn.models.ReclameAquiHugmeImportBatch) {
    return conn.models.ReclameAquiHugmeImportBatch as Model<IReclameAquiHugmeImportBatch>;
  }
  return conn.model<IReclameAquiHugmeImportBatch>(
    'ReclameAquiHugmeImportBatch',
    ReclameAquiHugmeImportBatchSchema,
    'reclame_aqui_hugme_import_batches',
  );
}

export type { IReclameAquiHugmeRegistro, IReclameAquiHugmeImportBatch };
