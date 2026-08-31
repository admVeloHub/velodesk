/** protocolo.service v2.0.0 — protocolo AAMMDDXXXX com contador diário (sequence_counters em b2c_chamados) */
import mongoose from 'mongoose';
import { isMongoConnected } from '../config/database';

const SEQUENCE_ID = 'chamadoProtocolo';
const NUMERIC_PROTOCOL_RE = /^\d+$/;

function sequenceCountersCollection() {
  return mongoose.connection.collection<{ _id: string; day: string; value: number }>('sequence_counters');
}

/** Chave do dia civil BRT no formato AAMMDD usado como prefixo do protocolo. */
export function brDayKeyAAMMDD(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}`;
}

/** AAMMDD (6) + contador diário com 4 dígitos (ex.: 2508310001). Passa de 9999/dia sem quebrar (só alarga). */
export function formatProtocolo(day: string, value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Valor de protocolo inválido');
  }
  return `${day}${String(Math.trunc(value)).padStart(4, '0')}`;
}

export function parseProtocoloNumber(value: unknown): number | null {
  const trimmed = String(value ?? '').trim();
  if (!NUMERIC_PROTOCOL_RE.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Incrementa o contador do dia atomicamente via update-pipeline: se o `day` armazenado
 * já é o de hoje, soma 1; se mudou (virou o dia, ou documento ainda não existe), reseta pra 1.
 * Um único findOneAndUpdate — sem essa pipeline haveria uma janela de corrida na virada do dia
 * entre "ler o day" e "decidir resetar ou incrementar".
 */
async function allocateForDay(day: string): Promise<number> {
  const updated = await sequenceCountersCollection().findOneAndUpdate(
    { _id: SEQUENCE_ID },
    [
      {
        $set: {
          value: { $cond: [{ $eq: ['$day', day] }, { $add: ['$value', 1] }, 1] },
          day,
        },
      },
    ],
    { upsert: true, returnDocument: 'after' },
  );

  const nextValue = updated?.value;
  if (typeof nextValue !== 'number' || nextValue <= 0) {
    throw new Error('Contador de protocolo indisponível');
  }
  return nextValue;
}

export async function allocateNextProtocolo(): Promise<string> {
  const day = brDayKeyAAMMDD();

  if (!isMongoConnected()) {
    // Sem contador atômico disponível: usa os últimos 4 dígitos do timestamp como diferenciador
    // de melhor esforço. Risco de colisão é aceitável aqui pois só ocorre com Mongo fora do ar.
    const fallbackValue = Number(String(Date.now()).slice(-4)) || 1;
    console.warn(`[protocolo] Mongo indisponível — fallback ${formatProtocolo(day, fallbackValue)}`);
    return formatProtocolo(day, fallbackValue);
  }

  const nextValue = await allocateForDay(day);
  return formatProtocolo(day, nextValue);
}

export function isNumericProtocol(value: unknown): boolean {
  return NUMERIC_PROTOCOL_RE.test(String(value ?? '').trim());
}
