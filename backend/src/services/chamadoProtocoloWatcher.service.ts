/** chamadoProtocoloWatcher v1.0.1 — detecta inserts sem protocolo e atribui imediatamente */
import type { ChangeStream, ChangeStreamDocument } from 'mongodb';
import mongoose from 'mongoose';
import { isMongoConnected } from '../config/database';
import {
  assignProtocolIfNeeded,
  ensureChamadoProtocoloSparseIndex,
  reconcilePendingProtocolos,
} from './chamadoProtocoloAssign.service';
import { needsProtocolAssignment } from './protocoloUtils';

type ChamadoChangeStream = ChangeStream<Record<string, unknown>>;

let changeStream: ChamadoChangeStream | null = null;
const processingIds = new Set<string>();

async function handleChamadoId(chamadoId: string): Promise<void> {
  if (!chamadoId || processingIds.has(chamadoId)) return;
  processingIds.add(chamadoId);

  try {
    await assignProtocolIfNeeded(chamadoId);
  } catch (err) {
    console.warn('[protocolo-watcher] falha ao processar chamado:', chamadoId, (err as Error).message);
  } finally {
    processingIds.delete(chamadoId);
  }
}

function extractDocumentId(change: ChangeStreamDocument): string | null {
  if (change.operationType === 'insert') {
    const insertChange = change as ChangeStreamDocument & {
      fullDocument?: { _id?: { toString(): string } };
      documentKey?: { _id?: { toString(): string } };
    };
    return insertChange.fullDocument?._id?.toString()
      ?? insertChange.documentKey?._id?.toString()
      ?? null;
  }

  if (change.operationType === 'update') {
    const updateChange = change as ChangeStreamDocument & {
      updateDescription?: { updatedFields?: Record<string, unknown> };
      documentKey?: { _id?: { toString(): string } };
    };
    const protocolo = updateChange.updateDescription?.updatedFields?.chamadoProtocolo;
    if (protocolo !== undefined && needsProtocolAssignment(protocolo)) {
      return updateChange.documentKey?._id?.toString() ?? null;
    }
  }

  return null;
}

export async function startChamadoProtocoloWatcher(): Promise<void> {
  if (!isMongoConnected() || changeStream) return;

  await ensureChamadoProtocoloSparseIndex();
  await reconcilePendingProtocolos();

  const coll = mongoose.connection.collection('chamados_n1');
  const stream = coll.watch(
    [{ $match: { operationType: { $in: ['insert', 'update'] } } }],
    { fullDocument: 'updateLookup' },
  );
  changeStream = stream;

  stream.on('change', (change) => {
    if (change.operationType !== 'insert' && change.operationType !== 'update') return;

    const chamadoId = extractDocumentId(change);
    if (!chamadoId) return;

    if (change.operationType === 'insert') {
      void handleChamadoId(chamadoId);
      return;
    }

    const updateChange = change as ChangeStreamDocument & {
      fullDocument?: { chamadoProtocolo?: string };
    };
    if (needsProtocolAssignment(updateChange.fullDocument?.chamadoProtocolo)) {
      void handleChamadoId(chamadoId);
    }
  });

  stream.on('error', (err) => {
    console.error('[protocolo-watcher] change stream erro:', err);
    changeStream = null;
    setTimeout(() => {
      void startChamadoProtocoloWatcher();
    }, 5000);
  });

  console.log('[protocolo-watcher] ativo — novos chamados recebem protocolo automaticamente');
}

export async function stopChamadoProtocoloWatcher(): Promise<void> {
  if (!changeStream) return;
  await changeStream.close();
  changeStream = null;
}
