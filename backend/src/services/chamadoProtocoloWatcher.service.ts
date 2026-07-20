/** chamadoProtocoloWatcher v1.0.2 — change stream via mongoose (sem tipos mongodb v7) */
import mongoose from 'mongoose';
import { isMongoConnected } from '../config/database';
import {
  assignProtocolIfNeeded,
  ensureChamadoProtocoloSparseIndex,
  reconcilePendingProtocolos,
} from './chamadoProtocoloAssign.service';
import { needsProtocolAssignment } from './protocoloUtils';

/** Tipos locais — coll.watch() usa mongodb embutido no mongoose (v6), não o pacote mongodb v7 */
interface ChamadoChangeEvent {
  operationType: string;
  fullDocument?: {
    _id?: { toString(): string };
    chamadoProtocolo?: string;
  };
  documentKey?: { _id?: { toString(): string } };
  updateDescription?: { updatedFields?: Record<string, unknown> };
}

interface ChamadoWatchStream {
  on(event: 'change', listener: (change: ChamadoChangeEvent) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  close(): Promise<void>;
}

let changeStream: ChamadoWatchStream | null = null;
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

function extractDocumentId(change: ChamadoChangeEvent): string | null {
  if (change.operationType === 'insert') {
    return change.fullDocument?._id?.toString()
      ?? change.documentKey?._id?.toString()
      ?? null;
  }

  if (change.operationType === 'update') {
    const protocolo = change.updateDescription?.updatedFields?.chamadoProtocolo;
    if (protocolo !== undefined && needsProtocolAssignment(protocolo)) {
      return change.documentKey?._id?.toString() ?? null;
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
  ) as unknown as ChamadoWatchStream;

  changeStream = stream;

  stream.on('change', (change) => {
    if (change.operationType !== 'insert' && change.operationType !== 'update') return;

    const chamadoId = extractDocumentId(change);
    if (!chamadoId) return;

    if (change.operationType === 'insert') {
      void handleChamadoId(chamadoId);
      return;
    }

    if (needsProtocolAssignment(change.fullDocument?.chamadoProtocolo)) {
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
