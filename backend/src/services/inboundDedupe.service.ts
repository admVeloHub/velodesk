/** inboundDedupe.service v1.0.0 — claim atômico por Message-Id (evita ticket duplicado entre instâncias) */
import { isDeskConfigConnected } from '../config/database';
import {
  getGmailInboundMessageModel,
  type GmailInboundMessageStatus,
} from '../models/GmailInboundMessage';

/** Claim preso por mais que isso é considerado abandonado (instância morreu no meio) */
const STALE_CLAIM_MS = 5 * 60 * 1000;
/** Tentativas máximas antes de parar de reprocessar uma mensagem que falha sempre */
const MAX_ATTEMPTS = 5;

export interface InboundClaimSnapshot {
  status?: GmailInboundMessageStatus;
  action?: string;
  chamadoProtocolo?: string;
  ticketId?: string;
  attempts?: number;
}

export type InboundClaim =
  | { granted: true; degraded?: boolean }
  | { granted: false; reason: 'in-progress' | 'done' | 'exhausted'; previous?: InboundClaimSnapshot };

function isDuplicateKeyError(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return code === 11000;
}

/**
 * Reserva o processamento de um Message-Id. Só um worker recebe granted=true.
 * Fail-soft: se desk_config estiver indisponível, libera o processamento (comportamento legado).
 */
export async function claimInboundMessage(messageId: string): Promise<InboundClaim> {
  if (!messageId) return { granted: true };
  if (!isDeskConfigConnected()) return { granted: true, degraded: true };

  const Model = getGmailInboundMessageModel();
  const now = new Date();

  try {
    await Model.create({ messageId, status: 'processing', attempts: 1, claimedAt: now });
    return { granted: true };
  } catch (err) {
    if (!isDuplicateKeyError(err)) {
      console.warn('[inboundDedupe] claim indisponível — seguindo sem lock:', (err as Error).message);
      return { granted: true, degraded: true };
    }
  }

  const staleLimit = new Date(now.getTime() - STALE_CLAIM_MS);
  const retaken = await Model.findOneAndUpdate(
    {
      messageId,
      attempts: { $lt: MAX_ATTEMPTS },
      $or: [
        { status: 'failed' },
        { status: 'processing', claimedAt: { $lt: staleLimit } },
      ],
    },
    { $set: { status: 'processing', claimedAt: now }, $inc: { attempts: 1 } },
    { new: true },
  ).exec();

  if (retaken) {
    console.info('[inboundDedupe] claim retomado', { messageId, attempts: retaken.attempts });
    return { granted: true };
  }

  const existing = await Model.findOne({ messageId }).lean().exec();
  const previous: InboundClaimSnapshot | undefined = existing
    ? {
        status: existing.status,
        action: existing.action,
        chamadoProtocolo: existing.chamadoProtocolo,
        ticketId: existing.ticketId,
        attempts: existing.attempts,
      }
    : undefined;

  if (existing?.status === 'done') {
    return { granted: false, reason: 'done', previous };
  }
  if (existing && existing.attempts >= MAX_ATTEMPTS) {
    return { granted: false, reason: 'exhausted', previous };
  }
  return { granted: false, reason: 'in-progress', previous };
}

export async function markInboundMessageDone(
  messageId: string,
  data: { action: string; chamadoProtocolo?: string; ticketId?: string },
): Promise<void> {
  if (!messageId || !isDeskConfigConnected()) return;
  try {
    await getGmailInboundMessageModel().updateOne(
      { messageId },
      {
        $set: {
          status: 'done',
          action: data.action,
          chamadoProtocolo: data.chamadoProtocolo ?? '',
          ticketId: data.ticketId ?? '',
          error: '',
        },
      },
    ).exec();
  } catch (err) {
    console.warn('[inboundDedupe] markDone falhou:', (err as Error).message);
  }
}

export async function markInboundMessageFailed(messageId: string, error: string): Promise<void> {
  if (!messageId || !isDeskConfigConnected()) return;
  try {
    await getGmailInboundMessageModel().updateOne(
      { messageId },
      { $set: { status: 'failed', error: String(error).slice(0, 500) } },
    ).exec();
  } catch (err) {
    console.warn('[inboundDedupe] markFailed falhou:', (err as Error).message);
  }
}
