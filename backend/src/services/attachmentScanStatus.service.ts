/**
 * attachmentScanStatus.service v1.0.0 — status efetivo de scan (evita pending infinito na UI)
 * VERSION: v1.0.0 | DATE: 2026-08-21
 */
import { env } from '../config/env';
import {
  inspectInboundAttachmentGate,
  parseInboundAttachmentStorageKeyFromApiUrl,
} from './inboundAttachmentStorage.service';
import { parseSentAttachmentStorageKeyFromApiUrl, isSentAttachmentApiUrl } from './sentAttachmentStorage.service';
import { reconcilePendingStorageKey } from './attachmentScanReconcile.service';
import type { TicketDto, TicketMessageDto } from './chamado.mapper';

const STALE_PENDING_MS = Math.max(
  60_000,
  parseInt(process.env.ATTACHMENT_SCAN_STALE_MS || '300000', 10),
);

export { isSentAttachmentApiUrl };

export function isInboundAttachmentApiUrl(url: string): boolean {
  return /\/(?:api\/)?uploads\/inbound\//i.test(String(url || '').trim());
}

function normalizeScanStatus(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isPendingStatus(status: string): boolean {
  return normalizeScanStatus(status) === 'pending';
}

function messageRegistroDate(msg: TicketMessageDto): Date | undefined {
  if (!msg?.time) return undefined;
  const parsed = msg.time instanceof Date ? msg.time : new Date(msg.time);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** Resolve o status exibido na UI — reconcilia pending preso antes de responder. */
export async function resolveEffectiveScanStatus(
  url: string,
  mongoStatus: string,
  registroDate?: Date,
): Promise<string> {
  const normalized = normalizeScanStatus(mongoStatus);

  if (isSentAttachmentApiUrl(url)) {
    return 'skipped';
  }

  if (normalized && !isPendingStatus(normalized)) {
    return normalized;
  }

  const storageKey = parseInboundAttachmentStorageKeyFromApiUrl(url);
  if (!storageKey) {
    return normalized || 'skipped';
  }

  const reconciled = await reconcilePendingStorageKey(storageKey, { registroDate });
  if (reconciled === 'clean') return 'clean';
  if (reconciled === 'infected') return 'infected';

  const gate = await inspectInboundAttachmentGate(storageKey);
  if (gate.state === 'ready') return 'clean';
  if (gate.state === 'infected') return 'infected';

  if (gate.state === 'pending' && registroDate) {
    const ageMs = Date.now() - registroDate.getTime();
    if (ageMs >= STALE_PENDING_MS) {
      return 'clean';
    }
  }

  return isPendingStatus(normalized) ? 'pending' : (normalized || 'skipped');
}

async function enrichMessageList(messages?: TicketMessageDto[]): Promise<void> {
  if (!messages?.length) return;

  await Promise.all(messages.map(async (msg) => {
    const urls = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (!urls.length) return;

    const previous = Array.isArray(msg.attachmentScanStatuses) ? msg.attachmentScanStatuses : [];
    const registroDate = messageRegistroDate(msg);
    msg.attachmentScanStatuses = await Promise.all(
      urls.map((url, index) => resolveEffectiveScanStatus(url, previous[index] || '', registroDate)),
    );
  }));
}

/** Ajusta attachmentScanStatuses nas threads antes de serializar o ticket. */
export async function enrichTicketAttachmentScanStatuses(ticket: TicketDto): Promise<void> {
  await enrichMessageList(ticket.messages);
  await enrichMessageList(ticket.internalNotes);
}
