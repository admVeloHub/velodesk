/** protocolo.service v1.0.4 — sequence_counters em b2c_chamados */
import mongoose from 'mongoose';
import { ChamadoN1 } from '../models/ChamadoN1';
import { env } from '../config/env';
import { isMongoConnected } from '../config/database';

const SEQUENCE_ID = 'chamadoProtocolo';
const NUMERIC_PROTOCOL_RE = /^\d+$/;
/** Valores abaixo de 1e9: prefixo 0 + 9 dígitos (ex.: 0100177678); a partir de 1e9, 10 dígitos sem zero extra */
const PROTOCOL_EXPAND_AT = 1_000_000_000;

function sequenceFloor(): number {
  const parsed = Number.parseInt(String(env.ticketSequenceFloor || '100177678'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100177678;
}

function sequenceCountersCollection() {
  return mongoose.connection.collection<{ _id: string; value: number }>('sequence_counters');
}

export function formatProtocolo(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Valor de protocolo inválido');
  }
  if (value < PROTOCOL_EXPAND_AT) {
    return `0${String(Math.trunc(value)).padStart(9, '0')}`;
  }
  return String(Math.trunc(value));
}

export function parseProtocoloNumber(value: unknown): number | null {
  const trimmed = String(value ?? '').trim();
  if (!NUMERIC_PROTOCOL_RE.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function scanMaxNumericProtocol(): Promise<number> {
  const rows = await ChamadoN1.aggregate<{ protocolNum: number }>([
    { $match: { chamadoProtocolo: { $regex: /^\d+$/ } } },
    { $addFields: { protocolNum: { $toLong: '$chamadoProtocolo' } } },
    { $sort: { protocolNum: -1 } },
    { $limit: 1 },
  ]);

  const top = rows[0]?.protocolNum;
  return Number.isFinite(top) && top > 0 ? top : 0;
}

async function ensureCounterInitialized(): Promise<void> {
  const coll = sequenceCountersCollection();
  const existing = await coll.findOne({ _id: SEQUENCE_ID });
  if (existing) return;

  const maxInDb = await scanMaxNumericProtocol();
  const startValue = Math.max(sequenceFloor(), maxInDb);

  try {
    await coll.insertOne({ _id: SEQUENCE_ID, value: startValue });
    console.log(
      `[protocolo] contador em ${env.mongoDbName}.sequence_counters inicializado em ${startValue} → exibição ${formatProtocolo(startValue)} (floor=${sequenceFloor()}, maxDb=${maxInDb})`,
    );
  } catch {
    /* outra instância inicializou em paralelo */
  }
}

export async function allocateNextProtocolo(): Promise<string> {
  if (!isMongoConnected()) {
    const maxInDb = await scanMaxNumericProtocol();
    const next = Math.max(sequenceFloor(), maxInDb) + 1;
    console.warn(`[protocolo] ${env.mongoDbName} indisponível — fallback ${formatProtocolo(next)}`);
    return formatProtocolo(next);
  }

  await ensureCounterInitialized();
  const updated = await sequenceCountersCollection().findOneAndUpdate(
    { _id: SEQUENCE_ID },
    { $inc: { value: 1 } },
    { returnDocument: 'after' },
  );

  const nextValue = updated?.value;
  if (typeof nextValue !== 'number' || nextValue <= 0) {
    throw new Error('Contador de protocolo indisponível');
  }

  return formatProtocolo(nextValue);
}

export function isNumericProtocol(value: unknown): boolean {
  return NUMERIC_PROTOCOL_RE.test(String(value ?? '').trim());
}
