/** chamadoProtocoloAssign v1.0.0 — atribuição atômica de protocolo pelo Desk */
import mongoose from 'mongoose';
import { ChamadoN1 } from '../models/ChamadoN1';
import type { IChamadoN1 } from '../models/ChamadoN1';
import { isMongoConnected } from '../config/database';
import { allocateNextProtocolo } from './protocolo.service';
import { buildPendingProtocolFilter, needsProtocolAssignment } from './protocoloUtils';

export async function ensureChamadoProtocoloSparseIndex(): Promise<void> {
  if (!isMongoConnected()) return;

  const coll = mongoose.connection.collection('chamados_n1');
  const indexes = await coll.indexes();
  const existing = indexes.find((idx) => idx.name === 'chamadoProtocolo_1');

  if (existing?.sparse === true && existing.unique === true) return;

  try {
    if (existing) {
      await coll.dropIndex('chamadoProtocolo_1');
      console.log('[protocolo] índice chamadoProtocolo_1 recriado como sparse unique');
    }
  } catch (err) {
    console.warn('[protocolo] dropIndex chamadoProtocolo_1:', (err as Error).message);
  }

  await coll.createIndex(
    { chamadoProtocolo: 1 },
    { unique: true, sparse: true, name: 'chamadoProtocolo_1' },
  );
}

export async function assignProtocolIfNeeded(chamadoId: string): Promise<IChamadoN1 | null> {
  const id = String(chamadoId ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const chamado = await ChamadoN1.findById(id);
  if (!chamado || !needsProtocolAssignment(chamado.chamadoProtocolo)) {
    return chamado;
  }

  const protocolo = await allocateNextProtocolo();
  const updated = await ChamadoN1.findOneAndUpdate(
    { _id: id, ...buildPendingProtocolFilter() },
    { $set: { chamadoProtocolo: protocolo } },
    { new: true },
  );

  if (updated) {
    console.info('[protocolo] atribuído', { ticketId: id, chamadoProtocolo: protocolo });
    return updated;
  }

  return ChamadoN1.findById(id);
}

export async function reconcilePendingProtocolos(limit = 50): Promise<number> {
  if (!isMongoConnected()) return 0;

  const pending = await ChamadoN1.find(buildPendingProtocolFilter())
    .select('_id')
    .sort({ createdAt: 1 })
    .limit(limit);

  let assigned = 0;
  for (const doc of pending) {
    const result = await assignProtocolIfNeeded(doc._id.toString());
    if (result && !needsProtocolAssignment(result.chamadoProtocolo)) {
      assigned += 1;
    }
  }

  if (assigned > 0) {
    console.info(`[protocolo] reconcile: ${assigned} chamado(s) receberam protocolo`);
  }

  return assigned;
}
